import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { generateEpochTimestamps } from "../test/utils";

describe("Non-Collateralized Loan Contract -- Native Token V2", function () {
  async function deployLoanFixture() {
    await network.provider.send("hardhat_reset");
    const [owner, addr1, addr2] = await ethers.getSigners();

    // Loan Parameters
    const initialLoanAmount: bigint = BigInt(1000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const lockUpPeriodInMonths: bigint = BigInt(18);
    const transactionBPS: bigint = BigInt(80);

    // Deploy loan contract
    const Loan = await ethers.getContractFactory("NonCollateralizedLoanNative");
    const hardhatLoan = await upgrades.deployProxy(Loan, [
      initialLoanAmount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionBPS,
      addr1.address
    ], { initializer: 'initialize' });
    await hardhatLoan.waitForDeployment();
    return { Loan, hardhatLoan, owner, addr1, addr2, initialLoanAmount, apy, lockUpPeriodInMonths, transactionBPS };
  }

  // DEPLOYMENT tests
  describe("Deployment", function () {
    it("Should set addr1 as lender", async function () {
      const { hardhatLoan, addr1 } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.lender()).to.equal(addr1.address);
    });

    it("Should set the status of the loan as Created", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.loanState()).to.equal(0);
    });

    it("Should assign the initialLoanAmount of tokens to the contract", async function () {
      const { hardhatLoan, initialLoanAmount } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.initialLoanAmount() / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should set the msg.sender as the owner", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.owner()).to.equal(owner.address);
    });
  });

  // SET BORROWER tests
  describe("Set Borrower", function () {
    it("Should allow the owner to set the borrower", async function () {
      const { hardhatLoan, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.setBorrower(addr2);
      expect(await hardhatLoan.borrower()).to.equal(addr2.address);
    });
  
    it("Should prevent users who are not the owner from setting borrower", async function () {
      const { hardhatLoan, addr2 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr2).setBorrower(addr2)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // FUND LOAN tests
  describe("Fund Loan", function () {
    it("Should transfer the initialLoanAmount to the contract", async function () {
      const { hardhatLoan, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoan.balance() / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate the TLV and set currentBalance", async function () {
      const { hardhatLoan, addr1, apy, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });

      // Calculate off-chain total loan value
      const offChainTLV = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3));
      
      expect(await hardhatLoan.currentBalance() / BigInt(1e16)).to.equal(Number(offChainTLV.toFixed(2)) * 100);
    });

    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoan.loanState()).to.equal(1);
    });

    it("Should emit LoanFunded event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) }))
      .to.emit(hardhatLoan, "LoanFunded")
      .withArgs(owner.address, owner.address, owner.address, initialLoanAmount, true, '0x');
    });
    
    it("Should only allow the lender to fund the loan", async function () {
      const { hardhatLoan, owner, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(owner).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) }))
        .to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized')
        .withArgs(owner.address);
    });
  });

  // ACCEPT LOAN tests
  describe("Accept Loan", function () {
    it("Should transfer the balance to addr2", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);

      // Get addr2 balance before accepting loan
      const addrBalancePreLoan = await ethers.provider.getBalance(addr2.address) / BigInt(1e18);
      const gasFee = BigInt(1);

      await hardhatLoan.connect(addr2).acceptLoan();
      expect(((await ethers.provider.getBalance(addr2.address) / BigInt(1e18)) - addrBalancePreLoan) + gasFee).to.equal(initialLoanAmount);
    });

    it("Should calculate balance (loan + interest)", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, apy, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      
      const offChainGrossMonthlyPayment = (Number(ethers.parseEther(initialLoanAmount.toString())) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      expect(await hardhatLoan.currentBalance() / BigInt(1e18)).to.equal(BigInt((offChainTransactionFee + offChainNetMonthlyPayment) * 36) / BigInt(1e18));
    });
    
    it("Should set the loan state to Taken", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      expect(await hardhatLoan.loanState()).to.equal(2);
    });

    it("Should emit LoanAccepted event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);

      expect(await hardhatLoan.connect(addr2).acceptLoan())
        .to.emit(hardhatLoan, "LoanAccepted")
        .withArgs(addr2.address, addr2.address, addr1.address, ethers.parseEther(initialLoanAmount.toString()), true, '0x');
    });

    it("Should only allow the borrower to accept the loan", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await expect(hardhatLoan.connect(addr1).acceptLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr1.address);
    });
  });

  // SET PAYMENT SCHEDULE tests
  describe("Set schedule", function () {
    it("Should set the schedule and due date index", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      expect(await hardhatLoan.paymentIndex()).to.equal(0);
      expect(await hardhatLoan.paymentSchedule(3)).to.equal(generateEpochTimestamps()[3]);
    });

    it("Should prevent any user besides the owner to set payment schedule", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await expect(hardhatLoan.connect(addr1).setPaymentSchedule(generateEpochTimestamps())).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // SET PAYMENT INDEX tests
  describe("Set payment index", function () {
    it("Should set the payment index", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      await hardhatLoan.setPaymentIndex(12);
      expect(await hardhatLoan.paymentIndex()).to.equal(12);
    });
    
    it("Should prevent any user besides the owner to set payment index", async function () {
      const { hardhatLoan, addr1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr1).setPaymentIndex(12)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // CALCULATE MONTHLY PAYMENT tests
  describe("Calculate Monthly Payment", function () {
    it("Should properly calculate monthly payment and transaction fee", async function () {
      const { hardhatLoan, addr1, apy, initialLoanAmount, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.calculateMonthlyPayment();
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 10000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;

      // Uncomment for debugging purposes
      // console.log("TLV: ", ethers.formatEther(await hardhatLoan.currentBalance()));
      // console.log("Monthly Payment: ", ethers.formatEther(netMonthlyPayment));
      // console.log("Transaction Fee: ", ethers.formatEther(transactionFee));
      // console.log("Offchain TLV: ", (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)).toFixed(3));
      // console.log("Offchain Monthly Payment: ", offChainNetMonthlyPayment.toFixed(6));
      // console.log("Offchain Transaction Fee: ", offChainTransactionFee.toFixed(6));

      expect(ethers.formatEther(netMonthlyPayment)).to.equal(offChainNetMonthlyPayment.toFixed(6));
      expect(ethers.formatEther(transactionFee)).to.equal(offChainTransactionFee.toFixed(6));
    });
  });

  // MAKE PAYMENT tests
  describe("Make Payment", function () {
    it("Should prevent borrower from making a payment because loan is not due yet", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();

      // Set payment schedule to begin on 05.05.2025 
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
    });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment()).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should allow borrower to transfer tokens to the lender (i.e., make a payment)", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount, apy, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps(new Date('2022-05-08')));
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 10000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      // Set owner and addr balances to 0 for testing purposes
      await ethers.provider.send("hardhat_setBalance", [owner.address, "0x0"]);
      await ethers.provider.send("hardhat_setBalance", [addr1.address, "0x0"]);
      
      // Make payment
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.connect(addr2).calculateMonthlyPayment();
      await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee });

      // Ensure owner and addr1 balances reflect payments
      expect(ethers.formatEther(await ethers.provider.getBalance(addr1))).to.equal(offChainNetMonthlyPayment.toFixed(6));
      expect(ethers.formatEther(await ethers.provider.getBalance(owner))).to.equal(offChainTransactionFee.toFixed(6));

      // Ensure current balance has been updated and payment index moved forward
      expect(await hardhatLoan.currentBalance() / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 35)))
      expect(await hardhatLoan.paymentIndex()).to.equal(1);
    });

    it("Should prevent user from making payment once current balance is 0", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      const paymentSchedule = generateEpochTimestamps(new Date('2022-05-08'));
      await hardhatLoan.setPaymentSchedule(paymentSchedule);

      // Move time forward and pay off loan
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.connect(addr2).calculateMonthlyPayment();
      await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee });
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee });
        }
      } catch (error) {
        console.error(error);
      }

      await expect(hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee })).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });

    it("Should emit PaymentMade event", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount, apy, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps(new Date('2022-05-08')));
      
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.connect(addr2).calculateMonthlyPayment();
      expect(await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee }))
        .to.emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, addr1, netMonthlyPayment, true, '0x')
        .emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, owner, transactionFee, true, '0x');
    });

    it("Should emit LoanRepayed event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      const paymentSchedule = generateEpochTimestamps(new Date('2022-05-08'));
      await hardhatLoan.setPaymentSchedule(paymentSchedule);

      // Move time forward and pay off loan
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.connect(addr2).calculateMonthlyPayment();
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          expect(await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee }))
        }
      } catch (error) {
        console.error(error);
      }
      expect(await hardhatLoan.connect(addr2).makePayment({ value: netMonthlyPayment + transactionFee }))
        .to.emit(hardhatLoan, "LoanRepayed");
    });
  });

  // LIQUIDATE LOAN tests
  describe("Liquidate Loan", function () {
    it("Should transfer the initialLoanAmount back to the lender", async function () {
      const { hardhatLoan, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);

      // Fund loan and get gasUsed to correctly calculate remaining balance
      // console.log('Before funding loan: ', await ethers.provider.getBalance(addr1));
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      
      // Liquidate loan and get gasUsed to correctly calculate remaining balance
      // console.log('Before liquidating loan: ', await ethers.provider.getBalance(addr1));
      await hardhatLoan.connect(addr1).liquidiateLoan();
      
      // Loan balance should be 0 after loan is liquidated
      expect(await hardhatLoan.balance() / BigInt(1e18)).to.equal(0);
      
      // Remaining addr1 balance after loan liquidation must factor in gas fees
      // console.log('After liquidating loan: ', await ethers.provider.getBalance(addr1));
      expect(Math.round(Number(ethers.formatEther(await ethers.provider.getBalance(addr1))))).to.equal(10000);
    });

    it("Should emit LoanLiquidated event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoan.connect(addr1).liquidiateLoan())
        .to.emit(hardhatLoan, "LoanLiquidated")
        .withArgs(owner, hardhatLoan.target, addr1, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to liquidate the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await expect(hardhatLoan.connect(owner).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
      await expect(hardhatLoan.connect(addr2).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr2.address);
    });

    it("Should only allow lender to liquidate the loan before borrower accepts the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan({ value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await expect(hardhatLoan.connect(addr1).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });

  // SET LENDER tests
  describe("Set Lender", function () {
    it("Should allow the owner to set the lender", async function () {
      const { hardhatLoan, addr2 } = await loadFixture(deployLoanFixture);

      // Upgrade to V2 to include setLender() function
      const LoanV2 = await ethers.getContractFactory('NonCollateralizedLoanNativeV2');
      const loanAddress = await hardhatLoan.getAddress();
      await upgrades.upgradeProxy(loanAddress, LoanV2);
      const upgradedLoan = LoanV2.attach(loanAddress);

      // Update lender using new function
      await upgradedLoan.setLender(addr2);
      expect(await upgradedLoan.lender()).to.equal(addr2.address);
    });
  
    it("Should prevent users who are not the owner from setting lender", async function () {
      const { hardhatLoan, addr2 } = await loadFixture(deployLoanFixture);

      // Upgrade to V2 to include setLender() function
      const LoanV2 = await ethers.getContractFactory('NonCollateralizedLoanNativeV2');
      const loanAddress = await hardhatLoan.getAddress();
      await upgrades.upgradeProxy(loanAddress, LoanV2);
      const upgradedLoan = LoanV2.attach(loanAddress);

      // Try updating lender using new function with addr2 to trigger failure
      await expect(upgradedLoan.connect(addr2).setLender(addr2)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
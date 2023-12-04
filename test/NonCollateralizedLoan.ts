import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { generateEpochTimestamps } from "./utils";

describe("Loan contract", function () {
  async function deployLoanFixture() {
    // Deploy token to use in loan contract
    const Token = await ethers.getContractFactory("NyxToken");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const hardhatToken = await Token.deploy();
    await hardhatToken.waitForDeployment();

    // Loan Parameters
    const initialLoanAmount: bigint = BigInt(500000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const lockUpPeriodInMonths: bigint = BigInt(18);
    const transactionBPS: bigint = BigInt(80);
    
    // Deploy loan contract with address of newly minted token
    const Loan = await ethers.getContractFactory("NonCollateralizedLoan");
    const hardhatLoan = await upgrades.deployProxy(Loan, [
        initialLoanAmount,
        apy,
        amortizationPeriodInMonths,
        lockUpPeriodInMonths,
        transactionBPS,
        hardhatToken.target as string,
        addr1.address
    ]);
    await hardhatLoan.waitForDeployment();

    // Authorize operator to transfer 1M tokens for owner
    await hardhatToken.revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens 1M for addr1
    await hardhatToken.connect(addr1).revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.connect(addr1).authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens 1M for addr2
    await hardhatToken.connect(addr2).revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.connect(addr2).authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Mint additional .5M tokens for addr1 for funding loan
    await hardhatToken.mint(addr1.address, BigInt(500000) * BigInt(1e18), true, "0x");

    return { Loan, hardhatLoan, Token, hardhatToken, owner, addr1, addr2, initialLoanAmount, apy, lockUpPeriodInMonths, transactionBPS };
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
      const { hardhatLoan, hardhatToken, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate the TLV and set currentBalance", async function () {
      const { hardhatLoan, addr1, apy, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      // Calculate off-chain total loan value
      const offChainTLV = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3));
      
      expect(await hardhatLoan.currentBalance() / BigInt(1e16)).to.equal(Number(offChainTLV.toFixed(2)) * 100);
    });

    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      expect(await hardhatLoan.loanState()).to.equal(1);
    });

    it("Should emit LoanFunded event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.connect(addr1).fundLoan())
        .to.emit(hardhatLoan, "LoanFunded")
        .withArgs(owner.address, owner.address, owner.address, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to fund the loan", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(owner).fundLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
    });
  });

  // ACCEPT LOAN tests
  describe("Accept Loan", function () {
    it("Should transfer the balance to addr1", async function () {
      const { hardhatLoan, hardhatToken, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      expect(await hardhatToken.balanceOf(addr2.address) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate balance (loan + interest)", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, apy, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;

      expect(ethers.formatEther(await hardhatLoan.currentBalance())).to.equal(((offChainTransactionFee + offChainNetMonthlyPayment) * 36).toFixed(1));
    });
    
    it("Should set the loan state to Taken", async function () {
      const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      expect(await hardhatLoan.loanState()).to.equal(2);
    });

    it("Should emit LoanAccepted event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);

      expect(await hardhatLoan.connect(addr2).acceptLoan())
        .to.emit(hardhatLoan, "LoanAccepted")
        .withArgs(addr2.address, addr2.address, addr1.address, initialLoanAmount, true, '0x');
    });

    it("Should only allow the borrower to accept the loan", async function () {
      const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await expect(hardhatLoan.connect(addr1).acceptLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr1.address);
    });
  });
  
  // SET PAYMENT SCHEDULE tests
  describe("Set schedule", function () {
    it("Should set the schedule and due date index", async function () {
      const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      expect(await hardhatLoan.paymentIndex()).to.equal(0);
      expect(await hardhatLoan.paymentSchedule(3)).to.equal(generateEpochTimestamps()[3]);
    });

    it("Should prevent any user besides the owner to set payment schedule", async function () {
      const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
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
  describe("Make Payment", function () {
    it("Should prevent borrower from making a payment because loan is not due yet", async function () {
        const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
        await hardhatLoan.connect(addr1).fundLoan();
        await hardhatLoan.setBorrower(addr2);
        await hardhatLoan.connect(addr2).acceptLoan();

        // Set payment schedule to begin on 05.05.2025 
        await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
        await expect(hardhatLoan.connect(addr2).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
    });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment()).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should allow borrower to transfer tokens to the lender (i.e., make a payment)", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, addr2, initialLoanAmount, apy, transactionBPS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps(new Date('2022-05-08')));
      
            // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 10000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");
      
      // Make payment
      await hardhatLoan.connect(addr2).makePayment();

      // Ensure owner and addr1 balances reflect payments
      expect(ethers.formatEther(await hardhatToken.balanceOf(addr1))).to.equal(offChainNetMonthlyPayment.toFixed(3));
      expect(ethers.formatEther(await hardhatToken.balanceOf(owner))).to.equal(offChainTransactionFee.toFixed(3));

      // Ensure current balance has been updated and payment index moved forward
      expect(await hardhatLoan.currentBalance() / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 35)))
      expect(await hardhatLoan.paymentIndex()).to.equal(1);
    });

    it("Should prevent user from making payment once current balance is 0", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      const paymentSchedule = generateEpochTimestamps(new Date('2022-05-08'));
      await hardhatLoan.setPaymentSchedule(paymentSchedule);

      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");

      // Move time forward and pay off loan
      await hardhatLoan.connect(addr2).makePayment();
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment();
        }
      } catch (error) {
        console.error(error);
      }

      await expect(hardhatLoan.connect(addr2).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });

    it("Should emit PaymentMade event", async function () {
      const { hardhatLoan, owner, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps(new Date('2022-05-08')));
      
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.connect(addr2).calculateMonthlyPayment();
      expect(await hardhatLoan.connect(addr2).makePayment())
        .to.emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, addr1, netMonthlyPayment, true, '0x')
        .emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, owner, transactionFee, true, '0x');
    });

    it("Should emit LoanRepayed event", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      const paymentSchedule = generateEpochTimestamps(new Date('2022-05-08'));
      await hardhatLoan.setPaymentSchedule(paymentSchedule);

      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");

      // Move time forward and pay off loan
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment();
        }
      } catch (error) {
        console.error(error);
      }
      expect(await hardhatLoan.connect(addr2).makePayment())
        .to.emit(hardhatLoan, "LoanRepayed");
    });
  });

  // LIQUIDATE LOAN tests
  describe("Liquidate Loan", function () {
    it("Should transfer the initialLoanAmount back to the lender", async function () {
      const { hardhatLoan, hardhatToken, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(initialLoanAmount);
      await hardhatLoan.connect(addr1).liquidiateLoan();
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(0);
    });

    it("Should emit LoanLiquidated event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      expect(await hardhatLoan.connect(addr1).liquidiateLoan())
        .to.emit(hardhatLoan, "LoanLiquidated")
        .withArgs(owner, hardhatLoan.target, addr1, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to liquidate the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await expect(hardhatLoan.connect(owner).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
      await expect(hardhatLoan.connect(addr2).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr2.address);
    });

    it("Should only allow lender to liquidate the loan before borrower accepts the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan();
      await hardhatLoan.setBorrower(addr2);
      await hardhatLoan.connect(addr2).acceptLoan();
      await expect(hardhatLoan.connect(addr1).liquidiateLoan()).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });
});
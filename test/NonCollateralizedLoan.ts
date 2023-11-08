import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { generateEpochTimestamps } from "./utils";
import * as dotenv from 'dotenv';

dotenv.config();
const { UP_ADDR } = process.env;

describe("Loan contract", function () {
  async function deployLoanFixture() {
    // Deploy token to use in loan contract
    const Token = await ethers.getContractFactory("NyxToken");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const hardhatToken = await Token.deploy();
    await hardhatToken.waitForDeployment();

    // Deploy loan with address of newly minted token
    const Loan = await ethers.getContractFactory("NonCollateralizedLoan");
    const initialLoanAmount: bigint = BigInt(500000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const lockUpPeriodInMonths: bigint = BigInt(18);
    const transactionPercentage: bigint = BigInt(8)

    const hardhatLoan = await Loan.deploy(
      initialLoanAmount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionPercentage,
      hardhatToken.target as string,
      UP_ADDR as string
    );
    await hardhatLoan.waitForDeployment();

    // Authorize operator to transfer 1M tokens for owner
    await hardhatToken.revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens 1M for addr1
    await hardhatToken.connect(addr1).revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.connect(addr1).authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");
    
    return { Loan, hardhatLoan, Token, hardhatToken, owner, addr1, addr2, initialLoanAmount, apy, lockUpPeriodInMonths, transactionPercentage };
  }

  describe("Deployment", function () {
    it("Should set the creator as lender", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.lender()).to.equal(owner.address);
    });

    it("Should set the status of the loan as Created", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.loanState()).to.equal(0);
    });

    it("Should assign the initialLoanAmount of tokens to the contract", async function () {
      const { hardhatLoan, initialLoanAmount } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.initialLoanAmount() / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should set the nyxCarbon address as nyxCarbonAddress", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.nyxCarbonAddress()).to.equal(UP_ADDR);
    });
  });

  describe("Fund Loan", function () {
    it("Should transfer the initialLoanAmount to the contract", async function () {
      const { hardhatLoan, hardhatToken, owner, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      expect(await hardhatLoan.loanState()).to.equal(1);
    });  
  });

  describe("Accept Loan", function () {
    it("Should set addr1 as the borrower", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      expect(await hardhatLoan.borrower()).to.equal(addr1.address);
    });

    it("Should transfer the balance to addr1", async function () {
      const { hardhatLoan, hardhatToken, owner, addr1, initialLoanAmount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      expect(await hardhatToken.balanceOf(addr1.address) / BigInt(1e18)).to.equal(initialLoanAmount);
    });  

    it("Should calculate balance (loan + interest)", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, apy, transactionPercentage } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionPercentage) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      expect(await hardhatLoan.currentBalance() / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 36)));
    });
    
    it("Should set the loan state to Taken", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      expect(await hardhatLoan.loanState()).to.equal(2);
    });
  });
  
  describe("Set schedule", function () {
    it("Should set the schedule and due date index", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      expect(await hardhatLoan.paymentIndex()).to.equal(0);
      expect(await hardhatLoan.paymentSchedule(3)).to.equal(generateEpochTimestamps()[3]);
    });
  });

  describe("Calculate monthly payment & transaction fee", function () {
    it("Should properly calculate monthly payment & transaction fee", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, apy, transactionPercentage } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionPercentage) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      const [ calculatedTransactionFee, calculatedNetMonthlyPayment ] = await hardhatLoan.calculateMonthlyPayment();

      expect(calculatedTransactionFee / BigInt(1e18)).to.equal(BigInt(Math.round(offChainTransactionFee) - 1));
      expect(calculatedNetMonthlyPayment / BigInt(1e18)).to.equal(BigInt(Math.round(offChainNetMonthlyPayment) + 1));
    });
  });

  describe("Make Payment", function () {
    it("Should prevent borrower from making a payment because loan is not due yet", async function () {
        const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
        await hardhatLoan.connect(owner).fundLoan();
        await hardhatLoan.connect(addr1).acceptLoan();

        // Set payment schedule to begin on 05.05.2025 
        await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
        await expect(hardhatLoan.connect(addr1).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
    });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr1).makePayment()).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should allow borrower to transfer tokens to the lender (i.e., make a payment)", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, initialLoanAmount, apy, transactionPercentage } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      await hardhatLoan.setPaymentSchedule(generateEpochTimestamps(new Date('2022-05-08')));
      await hardhatLoan.connect(addr1).makePayment();
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionPercentage) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;

      expect(await hardhatToken.balanceOf(UP_ADDR as string) / BigInt(1e18)).to.equal(BigInt(Math.round(offChainTransactionFee) - 1));
      expect(await hardhatToken.balanceOf(owner.address) / BigInt(1e18)).to.equal(BigInt(Math.round(offChainNetMonthlyPayment) + 1));
      expect(await hardhatLoan.currentBalance() / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 35)))
      expect(await hardhatLoan.paymentIndex()).to.equal(1);
    });

    it("Should prevent user from making payment once current balance is 0", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      const paymentSchedule = generateEpochTimestamps(new Date('2022-05-08'));
      await hardhatLoan.setPaymentSchedule(paymentSchedule);

      // Mint additional .5M tokens for addr1 to account for profits off-chain
      hardhatToken.mint(addr1.address, BigInt(500000) * BigInt(1e18), true, "0x");

      // Move time forward and pay off loan
      await hardhatLoan.connect(addr1).makePayment();
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr1).makePayment();
        }
      } catch (error) {
        console.error(error);
      }

      // // First time calling makePayment() on loan with a zero balance should revert ZeroBalanceOnLoan
      // await expect(hardhatLoan.connect(addr1).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");

      await expect(hardhatLoan.connect(addr1).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });
});
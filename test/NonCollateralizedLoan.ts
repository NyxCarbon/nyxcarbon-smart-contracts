import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import * as dotenv from 'dotenv';

dotenv.config();
const { UP_ADDR, TOKEN_ADDR } = process.env;

describe("Loan contract", function () {
  async function deployLoanFixture() {
    // Deploy token to use in loan contract
    const Token = await ethers.getContractFactory("NyxToken");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const hardhatToken = await Token.deploy();
    await hardhatToken.waitForDeployment();

    // Deploy loan with address of newly minted token
    const Loan = await ethers.getContractFactory("NonCollateralizedLoan");
    const amount: bigint = BigInt(500000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const lockUpPeriodInMonths: bigint = BigInt(18);
    const transactionPercentage: bigint = BigInt(8)

    const hardhatLoan = await Loan.deploy(
      amount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionPercentage,
      hardhatToken.target as string,
      UP_ADDR as string
    );
    await hardhatLoan.waitForDeployment();

    // Authorize operator to transfer tokens for owner
    await hardhatToken.revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.authorizeOperator(hardhatLoan.target, amount * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens for addr1
    await hardhatToken.connect(addr1).revokeOperator(hardhatLoan.target, "0x");
    await hardhatToken.connect(addr1).authorizeOperator(hardhatLoan.target, amount * BigInt(1e18), "0x");
    
    return { Loan, hardhatLoan, Token, hardhatToken, owner, addr1, addr2, amount, apy, lockUpPeriodInMonths, transactionPercentage };
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

    it("Should assign the amount of tokens to the contract", async function () {
      const { hardhatLoan, amount } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.amount() / BigInt(1e18)).to.equal(amount);
    });

    it("Should set the nyxCarbon address as nyxCarbonAddress", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.nyxCarbonAddress()).to.equal(UP_ADDR);
    });
  });

  describe("Fund Loan", function () {
    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      expect(await hardhatLoan.loanState()).to.equal(1);
    });

    it("Should transfer the amount to the contract", async function () {
      const { hardhatLoan, hardhatToken, owner, amount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(amount);
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
      const { hardhatLoan, hardhatToken, owner, addr1, amount } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      expect(await hardhatToken.balanceOf(addr1.address) / BigInt(1e18)).to.equal(amount);
    });  

    it("Should set the loan state to Taken ", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      expect(await hardhatLoan.loanState()).to.equal(2);
    });
  });

  describe("Calculate monthly payment & transaction fee", function () {
    it("Should properly calculate monthly payment & transaction fee", async function () {
      const { hardhatLoan, owner, addr1, amount, apy, transactionPercentage } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      const offChainGrossMonthlyPayment = (Number(amount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionPercentage) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      const [ calculatedTransactionFee, calculatedNetMonthlyPayment ] = await hardhatLoan.calculateMonthlyPayment();

      expect(calculatedTransactionFee / BigInt(1e18)).to.equal(BigInt(Math.round(offChainTransactionFee) - 1));
      expect(calculatedNetMonthlyPayment / BigInt(1e18)).to.equal(BigInt(Math.round(offChainNetMonthlyPayment) + 1));
    });
  });

  describe("Make Payment", function () {
  // it("Should prevent borrower from making a payment because loan is not due yet", async function () {
  //     const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
  //     await hardhatLoan.connect(owner).fundLoan();
  //     await hardhatLoan.connect(addr1).acceptLoan();
  //     await expect(hardhatLoan.connect(addr1).makePayment()).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
  //   });
  // });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, owner, addr1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      await expect(hardhatLoan.connect(addr1).makePayment()).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should transfer the tokens from the borrower to the lender", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, amount, apy, transactionPercentage } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(owner).fundLoan();
      await hardhatLoan.connect(addr1).acceptLoan();
      await hardhatLoan.connect(addr1).makePayment();
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(amount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionPercentage) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;

      expect(await hardhatToken.balanceOf(UP_ADDR as string) / BigInt(1e18)).to.equal(BigInt(Math.round(offChainTransactionFee) - 1));
      expect(await hardhatToken.balanceOf(owner.address) / BigInt(1e18)).to.equal(BigInt(Math.round(offChainNetMonthlyPayment) + 1));
    });
  });
});
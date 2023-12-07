import { expect } from "chai";
import { AddressLike, ContractTransactionResponse, ContractRunner, Signer, Typed } from "ethers";
import { ethers } from "hardhat";
import { NonCollateralizedLoanNativeFactory } from "../typechain-types";

describe("Non-Collateralized Loan Factory Contract -- Native Token", function () {
  let owner: ContractRunner | null | undefined;
  let addr1: AddressLike | Typed;
  let addr2: AddressLike | Typed;
  let LoanFactory;
  let loanFactory: NonCollateralizedLoanNativeFactory & { deploymentTransaction(): ContractTransactionResponse; };

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy NonCollateralizedLoanNativeFactory
    LoanFactory = await ethers.getContractFactory("NonCollateralizedLoanNativeFactory");
    loanFactory = await LoanFactory.deploy();
    await loanFactory.waitForDeployment();
  });

  it("Should create a new loan", async function () {
    const initialLoanAmount = BigInt(500000);
    const apy = BigInt(14);
    const amortizationPeriodInMonths = BigInt(36);
    const lockUpPeriodInMonths = BigInt(18);
    const transactionBPS = BigInt(80);

    await loanFactory.connect(owner).createLoan(
      initialLoanAmount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionBPS,
      addr1.address
    );

    const deployedLoans = await loanFactory.getDeployedLoans();
    expect(deployedLoans.length).to.equal(1);

    const newLoanAddress = deployedLoans[0];
    const newLoan = await ethers.getContractAt("NonCollateralizedLoan", newLoanAddress);

    expect(await newLoan.initialLoanAmount() / BigInt(1e18)).to.equal(initialLoanAmount);
    expect(await newLoan.apy() / BigInt(1e18)).to.equal(apy);
    expect(await newLoan.amortizationPeriodInMonths()).to.equal(amortizationPeriodInMonths);
    expect(await newLoan.lockUpPeriodInMonths()).to.equal(lockUpPeriodInMonths);
    expect(await newLoan.lockUpPeriodInMonths()).to.equal(lockUpPeriodInMonths);
    expect(await newLoan.lender()).to.equal(await addr1.getAddress());
  });

  it("Should emit ContractCreated event when a new loan is created", async function () {
    const initialLoanAmount = BigInt(500000);
    const apy = BigInt(14);
    const amortizationPeriodInMonths = BigInt(36);
    const lockUpPeriodInMonths = BigInt(18);
    const transactionBPS = BigInt(80);

    await expect(
      loanFactory.connect(owner).createLoan(
        initialLoanAmount,
        apy,
        amortizationPeriodInMonths,
        lockUpPeriodInMonths,
        transactionBPS,
        addr1
      )
    )
      .to.emit(loanFactory, "ContractCreated");
  });

  it("Should return the list of deployed loans", async function () {
    const initialLoanAmount = BigInt(500000);
    const apy = BigInt(14);
    const amortizationPeriodInMonths = BigInt(36);
    const lockUpPeriodInMonths = BigInt(18);
    const transactionBPS = BigInt(80);

    await loanFactory.connect(owner).createLoan(
      initialLoanAmount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionBPS,
      addr1
    );

    await loanFactory.connect(owner).createLoan(
      initialLoanAmount,
      apy,
      amortizationPeriodInMonths,
      lockUpPeriodInMonths,
      transactionBPS,
      addr2
    );

    const deployedLoans = await loanFactory.getDeployedLoans();
    expect(deployedLoans.length).to.equal(2);
  });
});

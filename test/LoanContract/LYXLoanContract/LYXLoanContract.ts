import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { subtractMonths, generateEpochTimestamps, convertUInt256ToBytes, convertBytesToString, convertBytesToInt256 } from "../../utils";

describe("Loan Contract -- Native Token", function () {
  async function deployLoanFixture() {
    await network.provider.send("hardhat_reset");

    // Constants & Loan Parameters
    const [owner, addr1, addr2] = await ethers.getSigners();

    // Loan Parameters
    const initialLoanAmount: bigint = BigInt(1000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const gracePeriodInMonths: bigint = BigInt(18);
    const transactionBPS: bigint = BigInt(80);
    const carbonCreditsStaked: bigint = BigInt(25);
    const carbonCreditPrice: bigint = BigInt(40);
    const verifiedProjectName: string = "Ecotone Renewables 1";
    const verifiedProjectLink: string = "https://data.climateactiondata.org/project?id=00067fdb-a354-4fe0-936d-587a7f43be9b&searchFlow=project";
    const verifiedProjectUnits: bigint = BigInt(1000);
    const verifiedProjectGeographicIdentifier: string = "-14.235004, -51.92528";
    const verifiedProjectVerificationLink: string = "https://data.climateactiondata.org/project?id=f18ebb58-ba73-48f3-b792-4155563f34d5&searchFlow=project"


    const loanParams = {
      initialLoanAmount: initialLoanAmount,
      apy: apy,
      amortizationPeriodInMonths: amortizationPeriodInMonths,
      gracePeriodInMonths: gracePeriodInMonths,
      transactionBps: transactionBPS,
      lender: addr1,
      borrower: addr2,
      carbonCreditsStaked: carbonCreditsStaked
    };

    const tokenId1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const tokenId2 = "0x0000000000000000000000000000000000000000000000000000000000000002";
    const _NYX_LENDER = "0x3d4ae42dee4156a448efc6820621c2bb68ddb71f0a85333f1c5ac246fc70519d";
    const _NYX_LOAN_STATUS = "0x4832cf0e94b7269e1cfb3481a8a7cb077570a24dba26f74290b300d0a11ff694";
    const _NYX_INITIAL_LOAN_AMOUNT = "0x6c0accaca6d414cfc7227817f26f010988cc73e73753912fdfaa53a8a58da914";
    const _NYX_BORROWER = "0x85749acc807d69123d0d5506d4f50090a074aeb2606b3c24031343bc2fe32ae9";
    const _NYX_LOAN_BALANCE = "0xa47b9177880a98391d6c9d9c68ce411d4e34d069439077790d5e35de0e929262";
    const _NYX_PAYMENT_INDEX = "0x2776cbcfd8490f894b0f24452a3c0cd4be0b007bd35e9a31d338400b8d8635ab";
    const _NYX_CARBON_CREDITS_BALANCE = "0x0fbaf537829b456ea9ce20bff34b6432649b4d01046f31011b072b99544cb3ba";
    const _NYX_VERIFIED_PROJECT_NAMES = "0x71143f1158ce915633afa53e4290c2a1b637a8aa3ea7fb439ba131fb2d646808";
    const _NYX_VERIFIED_PROJECT_LINKS = "0x7836eb2501883488d409285c1540ef51e4c8bfa9a862734eb54ff84ce4cc46d7";
    const _NYX_VERIFIED_PROJECT_UNITS = "0xecce39cdb4f559d5ed120e7490f76f8b55f040094665424b10de24c65aeead6e";
    const _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS = "0x438b3966c6fb3629949c4fd713334177cc151dfe49ac8ba2299b272e333c02eb";
    const _NYX_VERIFIED_PROJECT_VERIFICATION_LINKS = "0x6c1718525d902c3fbc20ecfb1209acee0fb762f9b0c0b2f6d1814c4627909110";

    // Deploy RWAV NFT contract to use in loan contract
    const RWAVerification = await ethers.getContractFactory("RWAVerification");
    const hardhatRWAVerification = await RWAVerification.deploy("RWAVerification", "RWAV", owner, owner);
    await hardhatRWAVerification.waitForDeployment();

    // Deploy NFT contract to use in loan contract
    const loanTxData = await ethers.getContractFactory("LoanTxData");
    const hardhatLoanTxData = await loanTxData.deploy("LoanTxData", "LTD", owner);
    await hardhatLoanTxData.waitForDeployment();

    // Deploy LoanMath library to use in loan contract
    const LoanMathLib = await ethers.getContractFactory("LoanMath");
    const hardhatLoanMathLib = await LoanMathLib.deploy();
    await hardhatLoanMathLib.waitForDeployment();

    // Deploy loan contract
    const Loan = await ethers.getContractFactory("LYXLoanContract", {
      libraries: {
        LoanMath: hardhatLoanMathLib.target as string
      },
    });
    const hardhatLoan = await Loan.deploy(hardhatLoanTxData.target as string, hardhatRWAVerification.target as string)
    await hardhatLoan.waitForDeployment();

    // Transfer ownership of the NFT contracts to the loan contract
    await hardhatLoanTxData.transferOwnership(hardhatLoan.target);
    await hardhatRWAVerification.transferOwnership(hardhatLoan.target);

    // Call function to create loan    
    await hardhatLoan.createLoan(
      loanParams
    );

    return { 
      Loan, 
      hardhatLoan, 
      loanTxData,
      hardhatLoanTxData,
      RWAVerification,
      hardhatRWAVerification,
      LoanMathLib,
      hardhatLoanMathLib,
      owner, 
      addr1, 
      addr2, 
      initialLoanAmount, 
      apy, 
      amortizationPeriodInMonths,
      gracePeriodInMonths, 
      transactionBPS,
      carbonCreditsStaked,
      carbonCreditPrice,
      verifiedProjectName,
      verifiedProjectLink,
      verifiedProjectUnits,
      verifiedProjectGeographicIdentifier,
      verifiedProjectVerificationLink,
      tokenId1,
      tokenId2,
      _NYX_LENDER,
      _NYX_LOAN_STATUS,
      _NYX_INITIAL_LOAN_AMOUNT,
      _NYX_BORROWER,
      _NYX_LOAN_BALANCE,
      _NYX_PAYMENT_INDEX,
      _NYX_CARBON_CREDITS_BALANCE,
      _NYX_VERIFIED_PROJECT_NAMES,
      _NYX_VERIFIED_PROJECT_LINKS,
      _NYX_VERIFIED_PROJECT_UNITS,
      _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS,
      _NYX_VERIFIED_PROJECT_VERIFICATION_LINKS
    };
  }

  // DEPLOYMENT tests
  describe("Deployment", function () {
    it("Should set addr1 as lender", async function () {
      const { hardhatLoanTxData, addr1, tokenId1, _NYX_LENDER } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoanTxData.getDecodedAddress(tokenId1, _NYX_LENDER)).to.equal(addr1.address);
    });

    it("Should set the status of the loan as Created", async function () {
      const { hardhatLoanTxData, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(0); // 0 == LoanState.Created
    });

    it("Should assign the initialLoanAmount of tokens to the contract", async function () {
      const { hardhatLoanTxData, initialLoanAmount, tokenId1, _NYX_INITIAL_LOAN_AMOUNT } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_INITIAL_LOAN_AMOUNT) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should set the msg.sender as the owner", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.owner()).to.equal(owner.address);
    });

  });

  // FUND LOAN tests
  describe("Fund Loan", function () {
    it("Should transfer the initialLoanAmount to the contract", async function () {
      const { hardhatLoan, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoan.balance(tokenId1) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate the TLV and set currentBalance", async function () {
      const { hardhatLoanTxData, hardhatLoan, addr1, apy, initialLoanAmount, tokenId1, _NYX_LOAN_BALANCE } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });

      // Calculate off-chain total loan value
      const offChainTLV = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3));
      
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE) / BigInt(1e16)).to.equal(Number(offChainTLV.toFixed(2)) * 100);
    });

    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, tokenId1, initialLoanAmount, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(1);
    });

    it("Should emit LoanFunded event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) }))
      .to.emit(hardhatLoan, "LoanFunded")
      .withArgs(owner.address, owner.address, owner.address, initialLoanAmount, true, '0x');
    });
    
    it("Should only allow the lender to fund the loan", async function () {
      const { hardhatLoan, owner, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(owner).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) }))
        .to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized')
        .withArgs(owner.address);
    });
  });

  // ADD Verified PROJECT tests
  describe("Add Verified Project & emit event", function () {
    it("Should add a Verified Project", async function () {
      const { hardhatLoan, tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.addVerifiedProject(tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink))
        .to.emit(hardhatLoan, "ProjectAdded")
        .withArgs(verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink, 0);
    });

    it("Should get the Verified Project metadata", async function () {
      const { hardhatLoan, tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink } = await loadFixture(deployLoanFixture);
      await hardhatLoan.addVerifiedProject(tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink);
      const projectMetadata0 = await hardhatLoan.getVerifiedProject(tokenId1, 0);
      
      expect(convertBytesToString(projectMetadata0[0])).to.equal(verifiedProjectName);
      expect(convertBytesToString(projectMetadata0[1])).to.equal(verifiedProjectLink);
      expect(convertBytesToInt256(projectMetadata0[2])).to.equal(verifiedProjectUnits);

      await hardhatLoan.addVerifiedProject(tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink);
      const projectMetadata1 = await hardhatLoan.getVerifiedProject(tokenId1, 1);
      
      expect(convertBytesToString(projectMetadata1[0])).to.equal(verifiedProjectName);
      expect(convertBytesToString(projectMetadata1[1])).to.equal(verifiedProjectLink);
      expect(convertBytesToInt256(projectMetadata1[2])).to.equal(verifiedProjectUnits);
    });

    it("Should update the units of carbon for a Verified Project", async function () {
      const { hardhatLoan, tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink, _NYX_VERIFIED_PROJECT_UNITS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.addVerifiedProject(tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink);
      
      expect(await hardhatLoan.updateVerifiedProjectElement(tokenId1, 0, _NYX_VERIFIED_PROJECT_UNITS, ethers.toBeArray(BigInt(250))))
        .to.emit(hardhatLoan, "ProjectElementUpdated")
        .withArgs(tokenId1, 0, _NYX_VERIFIED_PROJECT_UNITS, ethers.toBeArray(BigInt(250)));

      const projectMetadata = await hardhatLoan.getVerifiedProject(tokenId1, 0);
      
      expect(convertBytesToString(projectMetadata[0])).to.equal(verifiedProjectName);
      expect(convertBytesToString(projectMetadata[1])).to.equal(verifiedProjectLink);
      expect(ethers.toBigInt(ethers.hexlify(projectMetadata[2]))).to.equal(BigInt(250));
    });

    it("Should update the project name for a Verified Project", async function () {
      const { hardhatLoan, tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink, _NYX_VERIFIED_PROJECT_NAMES } = await loadFixture(deployLoanFixture);
      const newProjectName = "Remove Carbon 1";
      await hardhatLoan.addVerifiedProject(tokenId1, verifiedProjectName, verifiedProjectLink, verifiedProjectUnits, verifiedProjectGeographicIdentifier, verifiedProjectVerificationLink);
      
      expect(await hardhatLoan.updateVerifiedProjectElement(tokenId1, 0, _NYX_VERIFIED_PROJECT_NAMES, ethers.toUtf8Bytes(newProjectName)))
        .to.emit(hardhatLoan, "ProjectElementUpdated")
        .withArgs(tokenId1, 0, _NYX_VERIFIED_PROJECT_NAMES, ethers.toUtf8Bytes(newProjectName));

      const projectMetadata = await hardhatLoan.getVerifiedProject(tokenId1, 0);
      
      expect(convertBytesToString(projectMetadata[0])).to.equal(newProjectName);
      expect(convertBytesToString(projectMetadata[1])).to.equal(verifiedProjectLink);
      expect(convertBytesToInt256(projectMetadata[2])).to.equal(verifiedProjectUnits);
    });
  });

  // ACCEPT LOAN tests
  describe("Accept Loan", function () {
    it("Should transfer the balance to addr2", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });

      // Get addr2 balance before accepting loan
      const addrBalancePreLoan = await ethers.provider.getBalance(addr2.address) / BigInt(1e18);
      const gasFee = BigInt(1);

      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      expect(((await ethers.provider.getBalance(addr2.address) / BigInt(1e18)) - addrBalancePreLoan) + gasFee).to.equal(initialLoanAmount);
    });

    it("Should calculate balance (loan + interest)", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, apy, transactionBPS, tokenId1, _NYX_LOAN_BALANCE } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      expect(ethers.formatEther(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE))).to.equal(((offChainTransactionFee + offChainNetMonthlyPayment) * 36).toFixed(3));
    });
    
    it("Should set the loan state to Taken", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
    });

    it("Should emit LoanAccepted event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });

      expect(await hardhatLoan.connect(addr2).acceptLoan(tokenId1))
        .to.emit(hardhatLoan, "LoanAccepted")
        .withArgs(addr2.address, addr2.address, addr1.address, ethers.parseEther(initialLoanAmount.toString()), true, '0x');
    });

    it("Should only allow the borrower to accept the loan", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await expect(hardhatLoan.connect(addr1).acceptLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr1.address);
    });
  });

  // SET PAYMENT SCHEDULE tests
  describe("Set schedule", function () {
    it("Should set the schedule and due date index", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      const schedule = await hardhatLoan.getPaymentSchedule(tokenId1);
      expect(schedule[3]).to.equal(generateEpochTimestamps()[3]);
    });

    it("Should prevent any user besides the owner to set payment schedule", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await expect(hardhatLoan.connect(addr1).setPaymentSchedule(tokenId1, generateEpochTimestamps())).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // SET PAYMENT INDEX tests
  describe("Set payment index", function () {
    it("Should set the payment index", async function () {
      const { hardhatLoanTxData, hardhatLoan, tokenId1, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await hardhatLoan.callSetDataForTokenId(tokenId1, _NYX_PAYMENT_INDEX, convertUInt256ToBytes(12));
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_PAYMENT_INDEX)).to.equal(12);
    });
    
    it("Should prevent any user besides the owner to set payment index", async function () {
      const { hardhatLoan, addr1, tokenId1, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr1).callSetDataForTokenId(tokenId1, _NYX_PAYMENT_INDEX, convertUInt256ToBytes(12))).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // SET RWAV PRICE tests
  describe("Set RWAV Price", function () {
    it("Should set the RWAV price", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      expect(ethers.formatEther(await hardhatLoan.carbonCreditPrice())).to.equal('52.86');
    });
    
    it("Should only allow the owner to modify the RWAV price", async function () {
      const { hardhatLoan, addr1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr1).setCarbonCreditPrice(ethers.parseEther('52.86'))).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // EVALUATE SWAP STATE tests
  describe("Evalulate Swap State", function () {
    it("Should set the loan state to swappable when profit is greater than 32%", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(5);
    });

    it("Should emit LoanSwappable event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanSwappable")
        .withArgs(25, BigInt(3215) * BigInt(1e17), 3215)
    });


    it("Should set the loan state to swapped when profit is greater than 53%", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('62.00'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(6);
    });
    
    it("Should emit LoanSwapped event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('62.00'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanSwapped")
        .withArgs(25, BigInt(5500) * BigInt(1e17), 5500)
    });

    it("Should leave the loan state as Taken when profit is less than 32%", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
    });

    it("Should emit LoanNotSwappable event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanNotSwappable")
        .withArgs(25, BigInt(2500) * BigInt(1e17), 2500);
    });
    
    it("Should only allow the owner to evaluate loan swap state", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));      

      await expect(hardhatLoan.connect(addr1).evaluateSwapState(tokenId1)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // EXECUTE SWAP tests
  describe("Execute Swap", function () {
    it("Should execute the swap when the profit is greater than 32%", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);
      await hardhatLoan.executeSwap(tokenId1);
      
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE)).to.equal(0);
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(6);
    });
    
    it("Should emit LoanSwapped event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      await expect(hardhatLoan.executeSwap(tokenId1))
        .to.emit(hardhatLoan, "LoanSwapped")
        .withArgs(25, BigInt(3215) * BigInt(1e17), 3215)
    });

    it("Should only allow the owner to evaluate loan swap", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);    

      await expect(hardhatLoan.connect(addr1).executeSwap(tokenId1)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("Should throw LoanNotSwappable and set loanState back to Taken when RWAV price changes since evaluation", async function () {
      const { hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      // Set the RWAV price to simulate price decrease in between when the loan state was set to swappable and when borrower tried to execute swap
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));

      // Loan is no longer swappable due to profit percentage now only 25%
      await expect(hardhatLoan.executeSwap(tokenId1)).to.emit(hardhatLoan, "LoanNoLongerSwappable").withArgs(2500);
      
      // Loan state is set back to Taken
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
      
      // Function executeSwap() can not longer be called
      await expect(hardhatLoan.executeSwap(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });

  // MAKE PAYMENT tests
  describe("Make Payment", function () {
    it("Should prevent borrower from making a payment because loan is not due yet", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);

      // Set payment schedule to begin on 05.05.2025 
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
    });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1)).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should allow borrower to transfer tokens to the lender (i.e., make a payment)", async function () {
      const { hardhatLoan, hardhatLoanTxData, owner, addr1, addr2, initialLoanAmount, apy, transactionBPS, tokenId1, _NYX_LOAN_BALANCE, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps(subtractMonths(18)));
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 10000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      // Set owner and addr balances to 0 for testing purposes
      await ethers.provider.send("hardhat_setBalance", [owner.address, "0x0"]);
      await ethers.provider.send("hardhat_setBalance", [addr1.address, "0x0"]);
      
      // Make payment
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.calculatePayment(tokenId1);
      await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() });

      // Ensure owner and addr1 balances reflect payments
      expect(ethers.formatEther(await ethers.provider.getBalance(addr1))).to.equal(offChainNetMonthlyPayment.toFixed(6));
      expect(ethers.formatEther(await ethers.provider.getBalance(owner))).to.equal(offChainTransactionFee.toFixed(6));

      // Ensure current balance has been updated and payment index moved forward
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE) / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 35)))
      expect(await hardhatLoanTxData.getDecodedUint256(tokenId1, _NYX_PAYMENT_INDEX)).to.equal(1);
    });

    it("Should prevent user from making payment once current balance is 0", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      const paymentSchedule = generateEpochTimestamps(subtractMonths(18));
      await hardhatLoan.setPaymentSchedule(tokenId1, paymentSchedule);

      // Move time forward and pay off loan
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.calculatePayment(tokenId1);
      await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() });
      
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() });
        }
      } catch (error) {
        console.error(error);
      }

      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1, { value: netMonthlyPayment + transactionFee })).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });

    it("Should emit PaymentMade event", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps(subtractMonths(18)));
      
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.calculatePayment(tokenId1);
      expect(await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() }))
        .to.emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, addr1, netMonthlyPayment, true, '0x')
        .emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, owner, transactionFee, true, '0x');
    });

    it("Should emit LoanRepayed event", async function () {
      const { hardhatLoanMathLib, hardhatLoan, hardhatLoanTxData, addr1, addr2, initialLoanAmount, transactionBPS, amortizationPeriodInMonths, tokenId1, _NYX_LOAN_BALANCE } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      const paymentSchedule = generateEpochTimestamps(subtractMonths(18));
      await hardhatLoan.setPaymentSchedule(tokenId1, paymentSchedule);

      // Move time forward and pay off loan
      const [netMonthlyPayment, transactionFee] = await hardhatLoan.calculatePayment(tokenId1);
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          expect(await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() }))
        }
      } catch (error) {
        console.error(error);
      }
      expect(await hardhatLoan.connect(addr2).makePayment(tokenId1, { value: (netMonthlyPayment + transactionFee).toString() }))
        .to.emit(hardhatLoan, "LoanRepayed");
    });
  });

  // LIQUIDATE LOAN tests
  describe("Liquidate Loan", function () {
    it("Should transfer the initialLoanAmount back to the lender", async function () {
      const { hardhatLoan, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);

      // Fund loan and get gasUsed to correctly calculate remaining balance
      // console.log('Before funding loan: ', await ethers.provider.getBalance(addr1));
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      
      // Liquidate loan and get gasUsed to correctly calculate remaining balance
      // console.log('Before liquidating loan: ', await ethers.provider.getBalance(addr1));
      await hardhatLoan.connect(addr1).liquidiateLoan(tokenId1);
      
      // Loan balance should be 0 after loan is liquidated
      expect(await hardhatLoan.balance(tokenId1) / BigInt(1e18)).to.equal(0);
      
      // Remaining addr1 balance after loan liquidation must factor in gas fees
      // console.log('After liquidating loan: ', await ethers.provider.getBalance(addr1));
      expect(Math.round(Number(ethers.formatEther(await ethers.provider.getBalance(addr1))))).to.equal(10000);
    });

    it("Should emit LoanLiquidated event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      expect(await hardhatLoan.connect(addr1).liquidiateLoan(tokenId1))
        .to.emit(hardhatLoan, "LoanLiquidated")
        .withArgs(owner, hardhatLoan.target, addr1, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to liquidate the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await expect(hardhatLoan.connect(owner).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
      await expect(hardhatLoan.connect(addr2).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr2.address);
    });

    it("Should only allow lender to liquidate the loan before borrower accepts the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1, { value: ethers.parseEther(initialLoanAmount.toString()) });
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await expect(hardhatLoan.connect(addr1).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });
});
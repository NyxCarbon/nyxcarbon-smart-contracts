import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { subtractMonths, generateEpochTimestamps, convertUInt256ToBytes } from "../../utils";

describe("Non-Collateralized Loan Contract -- LSP7/ECR20 Token", function () {
  async function deployLoanFixture() {
    await network.provider.send("hardhat_reset");

    // Constants & Loan Parameters
    const [owner, addr1, addr2] = await ethers.getSigners();
    
    // Loan Parameters
    const initialLoanAmount: bigint = BigInt(500000);
    const apy: bigint = BigInt(14);
    const amortizationPeriodInMonths: bigint = BigInt(36);
    const lockUpPeriodInMonths: bigint = BigInt(18);
    const transactionBPS: bigint = BigInt(80);
    const carbonCreditsGenerated: bigint = BigInt(12500);
    const carbonCreditPrice: bigint = BigInt(40);
    const cadtProjectName: string = "Ecotone Renewables 1";
    const cadtRegistryLink: string = "https://data.climateactiondata.org/project?id=00067fdb-a354-4fe0-936d-587a7f43be9b&searchFlow=project";

    const loanParams = {
      initialLoanAmount: initialLoanAmount,
      apy: apy,
      amortizationPeriodInMonths: amortizationPeriodInMonths,
      lockUpPeriodInMonths: lockUpPeriodInMonths,
      transactionBps: transactionBPS,
      lender: addr1,
      borrower: addr2,
      carbonCreditsGenerated: carbonCreditsGenerated
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
    const _NYX_CADT_PROJECT_NAME = "0x98199bc97b113a64023a60ced2e5d698bfde533b56b4c126643fad99700b1f15";
    const _NYX_CADT_REGISTRY_LINK = "0x2ea835a0a77db3df9aa833b6e826b3f23a7f742036378de91f4fc345311e0945";

    // Deploy token to use in loan contract
    const Token = await ethers.getContractFactory("NyxToken");
    const hardhatToken = await Token.deploy();
    await hardhatToken.waitForDeployment();
    
    // Deploy Carbon Credit NFT contract to use in loan contract
    const CCNFTCollection = await ethers.getContractFactory("CarbonCreditNFTCollection");
    const hardhatCCNFTCollection = await CCNFTCollection.deploy("NyxCarbonCreditCollection", "NCCC", owner);
    await hardhatCCNFTCollection.waitForDeployment();

    // Deploy NFT contract to use in loan contract
    const NFT = await ethers.getContractFactory("NonCollateralizedLoanNFT");
    const hardhatNFT = await NFT.deploy("NYXLoanNFT", "NYXL", owner);
    await hardhatNFT.waitForDeployment();

    // Deploy LoanMath library to use in loan contract
    const LoanMathLib = await ethers.getContractFactory("LoanMath");
    const hardhatLoanMathLib = await LoanMathLib.deploy();
    await hardhatLoanMathLib.waitForDeployment();

    // Deploy loan contract with address of newly minted token
    const Loan = await ethers.getContractFactory("NonCollateralizedLoan", {
      libraries: {
        LoanMath: hardhatLoanMathLib.target as string
      },
    });
    const hardhatLoan = await Loan.deploy(hardhatNFT.target as string, hardhatCCNFTCollection.target as string, hardhatToken.target as string)
    await hardhatLoan.waitForDeployment();

    // Transfer ownership of the NFT contracts to the loan contract
    await hardhatNFT.transferOwnership(hardhatLoan.target);
    await hardhatCCNFTCollection.transferOwnership(hardhatLoan.target);

    // Call function to create loan    
    await hardhatLoan.createLoan(
      loanParams,
      cadtProjectName,
      cadtRegistryLink
    );
    
    // Authorize operator to transfer 1M tokens for owner
    await hardhatToken.revokeOperator(hardhatLoan.target, false, "0x");
    await hardhatToken.authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens 1M for addr1
    await hardhatToken.connect(addr1).revokeOperator(hardhatLoan.target, false, "0x");
    await hardhatToken.connect(addr1).authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Authorize operator to transfer tokens 1M for addr2
    await hardhatToken.connect(addr2).revokeOperator(hardhatLoan.target, false, "0x");
    await hardhatToken.connect(addr2).authorizeOperator(hardhatLoan.target, BigInt(1000000) * BigInt(1e18), "0x");

    // Mint additional .5M tokens for addr1 for funding loan
    await hardhatToken.mint(addr1.address, BigInt(500000) * BigInt(1e18), true, "0x");

    return { 
      Loan,
      hardhatLoan, 
      NFT,
      hardhatNFT,
      hardhatCCNFTCollection,
      CCNFTCollection,
      LoanMathLib,
      hardhatLoanMathLib,
      Token, 
      hardhatToken,
      owner, 
      addr1, 
      addr2, 
      initialLoanAmount, 
      apy, 
      amortizationPeriodInMonths,
      lockUpPeriodInMonths, 
      transactionBPS,
      carbonCreditsGenerated,
      carbonCreditPrice,
      cadtProjectName,
      cadtRegistryLink,
      tokenId1,
      tokenId2,
      _NYX_LENDER,
      _NYX_LOAN_STATUS,
      _NYX_INITIAL_LOAN_AMOUNT,
      _NYX_BORROWER,
      _NYX_LOAN_BALANCE,
      _NYX_PAYMENT_INDEX,
      _NYX_CARBON_CREDITS_BALANCE,
      _NYX_CADT_PROJECT_NAME,
      _NYX_CADT_REGISTRY_LINK
    };
  }

  // DEPLOYMENT tests
  describe("Deployment", function () {
    it("Should set addr1 as lender", async function () {
      const { hardhatNFT, addr1, tokenId1, _NYX_LENDER } = await loadFixture(deployLoanFixture);
      expect(await hardhatNFT.getDecodedAddress(tokenId1, _NYX_LENDER)).to.equal(addr1.address);
    });

    it("Should set the status of the loan as Created", async function () {
      const { hardhatNFT, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(0); // 0 == LoanState.Created
    });

    it("Should assign the initialLoanAmount of tokens to the contract", async function () {
      const { hardhatNFT, initialLoanAmount, tokenId1, _NYX_INITIAL_LOAN_AMOUNT } = await loadFixture(deployLoanFixture);
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_INITIAL_LOAN_AMOUNT) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should set the msg.sender as the owner", async function () {
      const { hardhatLoan, owner } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.owner()).to.equal(owner.address);
    });
  });
  
  // SET BORROWER tests
  describe("Set Borrower", function () {
    it("Should allow the owner to set the borrower", async function () {
      const { hardhatLoan, hardhatNFT, addr2, tokenId1, _NYX_BORROWER } = await loadFixture(deployLoanFixture);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      expect(await hardhatNFT.getDecodedAddress(tokenId1, _NYX_BORROWER)).to.equal(addr2.address);
    });
  
    it("Should prevent users who are not the owner from setting borrower", async function () {
      const { hardhatLoan, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr2).setBorrower(tokenId1, addr2)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // FUND LOAN tests
  describe("Fund Loan", function () {
    it("Should transfer the initialLoanAmount to the contract", async function () {
      const { hardhatLoan, hardhatToken, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate the TLV and set currentBalance", async function () {
      const { hardhatLoan, hardhatNFT, addr1, apy, initialLoanAmount, tokenId1, _NYX_LOAN_BALANCE } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      
      // Calculate off-chain total loan value
      const offChainTLV = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3));
      
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE) / BigInt(1e16)).to.equal(Number(offChainTLV.toFixed(2)) * 100);
    });

    it("Should set the status of the loan as Funded", async function () {
      const { hardhatLoan, hardhatNFT, addr1, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(1);
    });

    it("Should emit LoanFunded event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      expect(await hardhatLoan.connect(addr1).fundLoan(tokenId1))
        .to.emit(hardhatLoan, "LoanFunded")
        .withArgs(owner.address, owner.address, owner.address, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to fund the loan", async function () {
      const { hardhatLoan, owner, tokenId1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(owner).fundLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
    });
  });

  // ACCEPT LOAN tests
  describe("Accept Loan", function () {
    it("Should transfer the balance to addr1", async function () {
      const { hardhatLoan, hardhatToken, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      expect(await hardhatToken.balanceOf(addr2.address) / BigInt(1e18)).to.equal(initialLoanAmount);
    });

    it("Should calculate balance (loan + interest)", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, initialLoanAmount, apy, transactionBPS, tokenId1, _NYX_LOAN_BALANCE } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 1000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;

      expect(ethers.formatEther(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE))).to.equal(((offChainTransactionFee + offChainNetMonthlyPayment) * 36).toFixed(1));
    });
    
    it("Should set the loan state to Taken", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
    });

    it("Should emit LoanAccepted event", async function () {
      const { hardhatLoan, addr1, addr2, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);

      expect(hardhatLoan.connect(addr2).acceptLoan(tokenId1))
        .to.emit(hardhatLoan, "LoanAccepted")
        .withArgs(addr2.address, addr2.address, addr1.address, initialLoanAmount, true, '0x');
    });

    it("Should only allow the borrower to accept the loan", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await expect(hardhatLoan.connect(addr1).acceptLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr1.address);
    });
  });
  
  // SET PAYMENT SCHEDULE tests
  describe("Set schedule", function () {
    it("Should set the schedule and due date index", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      
      const schedule = await hardhatLoan.getPaymentSchedule(tokenId1);
      expect(schedule[3]).to.equal(generateEpochTimestamps()[3]);
    });

    it("Should prevent any user besides the owner to set payment schedule", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await expect(hardhatLoan.connect(addr1).setPaymentSchedule(tokenId1, generateEpochTimestamps())).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // SET PAYMENT INDEX tests
  describe("Set payment index", function () {
    it("Should set the payment index", async function () {
      const { hardhatNFT, hardhatLoan, tokenId1, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await hardhatLoan.callSetDataForTokenId(tokenId1, _NYX_PAYMENT_INDEX, convertUInt256ToBytes(12));
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_PAYMENT_INDEX)).to.equal(12);
    });
    
    it("Should prevent any user besides the owner to set payment index", async function () {
      const { hardhatLoan, addr1, tokenId1, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr1).callSetDataForTokenId(tokenId1, _NYX_PAYMENT_INDEX, convertUInt256ToBytes(12))).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // SET CARBON CREDIT PRICE tests
  describe("Set Carbon Credit Price", function () {
    it("Should set the carbon credit price", async function () {
      const { hardhatLoan } = await loadFixture(deployLoanFixture);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      expect(ethers.formatEther(await hardhatLoan.carbonCreditPrice())).to.equal('52.86');
    });
    
    it("Should only allow the owner to modify the carbon credit price", async function () {
      const { hardhatLoan, addr1 } = await loadFixture(deployLoanFixture);
      await expect(hardhatLoan.connect(addr1).setCarbonCreditPrice(ethers.parseEther('52.86'))).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // EVALUATE SWAP STATE tests
  describe("Evalulate Swap State", function () {
    it("Should set the loan state to swappable when profit is greater than 32%", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(5);
    });

    it("Should emit LoanSwappable event", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanSwappable")
        .withArgs(12500, BigInt(160750) * BigInt(1e18), 3215)
    });


    it("Should set the loan state to swapped when profit is greater than 53%", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('62.00'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(6);
    });
    
    it("Should emit LoanSwapped event", async function () {
      const { hardhatLoan, owner, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('62.00'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanSwapped")
        .withArgs(12500, BigInt(275000) * BigInt(1e18), 5500)
    });

    it("Should leave the loan state as Taken when profit is less than 32%", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
    });

    it("Should emit LoanNotSwappable event", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));

      await expect(hardhatLoan.evaluateSwapState(tokenId1))
        .to.emit(hardhatLoan, "LoanNotSwappable")
        .withArgs(12500, BigInt(125000) * BigInt(1e18), 2500);
    });
    
    it("Should only allow the owner to evaluate loan swap state", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1} = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));      

      await expect(hardhatLoan.connect(addr1).evaluateSwapState(tokenId1)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // EXECUTE SWAP tests
  describe("Execute Swap", function () {
    it("Should execute the swap when the profit is greater than 32%", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);
      await hardhatLoan.executeSwap(tokenId1);
      
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE)).to.equal(0);
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(6);
    });
    
    it("Should emit LoanSwapped event", async function () {
      const { hardhatLoan, owner, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      await expect(hardhatLoan.executeSwap(tokenId1))
        .to.emit(hardhatLoan, "LoanSwapped")
        .withArgs(12500, BigInt(160750) * BigInt(1e18), 3215)
    });

    it("Should only allow the owner to evaluate loan swap", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);    

      await expect(hardhatLoan.connect(addr1).executeSwap(tokenId1)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("Should throw LoanNotSwappable and set loanState back to Taken when carbon credit price changes since evaluation", async function () {
      const { hardhatLoan, hardhatNFT, addr1, addr2, tokenId1, _NYX_LOAN_STATUS } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('52.86'));
      await hardhatLoan.evaluateSwapState(tokenId1);

      // Set the carbon credit price to simulate price decrease in between when the loan state was set to swappable and when borrower tried to execute swap
      await hardhatLoan.setCarbonCreditPrice(ethers.parseEther('50.00'));

      // Loan is no longer swappable due to profit percentage now only 25%
      await expect(hardhatLoan.executeSwap(tokenId1)).to.emit(hardhatLoan, "LoanNoLongerSwappable").withArgs(2500);
      
      // Loan state is set back to Taken
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS)).to.equal(2);
      
      // Function executeSwap() can not longer be called
      await expect(hardhatLoan.executeSwap(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });

  // MAKE PAYMENT tests
  describe("Make Payment", function () {
    it("Should prevent borrower from making a payment because loan is not due yet", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);

      // Set payment schedule to begin on 05.05.2025 
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "PaymentNotDue");
    });

    it("Should not throw a zero balance error because the loan still has a balance", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps());
      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1)).to.not.be.revertedWithCustomError(hardhatLoan, "ZeroBalanceOnLoan");
    });

    it("Should allow borrower to transfer tokens to the lender (i.e., make a payment)", async function () {
      const { hardhatToken, hardhatLoan, hardhatNFT, owner, addr1, addr2, tokenId1, initialLoanAmount, apy, transactionBPS, _NYX_LOAN_BALANCE, _NYX_PAYMENT_INDEX } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps(subtractMonths(18)));
      
      // Offchain calculations
      const offChainGrossMonthlyPayment = (Number(initialLoanAmount) * ((1 + ((Number(apy) / 100) / 1)) ** 3)) / 36;
      const offChainTransactionFee = offChainGrossMonthlyPayment * (Number(transactionBPS) / 10000);
      const offChainNetMonthlyPayment = offChainGrossMonthlyPayment - offChainTransactionFee;
      
      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");
      
      // Make payment
      await hardhatLoan.connect(addr2).makePayment(tokenId1);

      // Ensure owner and addr1 balances reflect payments
      expect(ethers.formatEther(await hardhatToken.balanceOf(addr1))).to.equal(offChainNetMonthlyPayment.toFixed(3));
      expect(ethers.formatEther(await hardhatToken.balanceOf(owner))).to.equal(offChainTransactionFee.toFixed(3));

      // Ensure current balance has been updated and payment index moved forward
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_LOAN_BALANCE) / BigInt(1e18)).to.equal(BigInt(Math.round((offChainTransactionFee + offChainNetMonthlyPayment) * 35)))
      expect(await hardhatNFT.getDecodedUint256(tokenId1, _NYX_PAYMENT_INDEX)).to.equal(1);
    });

    it("Should prevent user from making payment once current balance is 0", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      const paymentSchedule = generateEpochTimestamps(subtractMonths(18));
      await hardhatLoan.setPaymentSchedule(tokenId1, paymentSchedule);

      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");

      // Move time forward and pay off loan
      await hardhatLoan.connect(addr2).makePayment(tokenId1);
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment(tokenId1);
        }
      } catch (error) {
        console.error(error);
      }

      await expect(hardhatLoan.connect(addr2).makePayment(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });

    it("Should emit PaymentMade event", async function () {
      const { hardhatLoanMathLib, hardhatLoan, owner, addr1, addr2, tokenId1, initialLoanAmount, transactionBPS, amortizationPeriodInMonths } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await hardhatLoan.setPaymentSchedule(tokenId1, generateEpochTimestamps(subtractMonths(18)));
      
      const [netMonthlyPayment, transactionFee] = await hardhatLoanMathLib.connect(addr2).calculateMonthlyPayment(initialLoanAmount, transactionBPS, amortizationPeriodInMonths);
      
      expect(await hardhatLoan.connect(addr2).makePayment(tokenId1))
        .to.emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, addr1, netMonthlyPayment, true, '0x')
        .emit(hardhatLoan, "PaymentMade")
        .withArgs(addr2, addr2, owner, transactionFee, true, '0x');
    });

    it("Should emit LoanRepayed event", async function () {
      const { hardhatToken, hardhatLoan, owner, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      const paymentSchedule = generateEpochTimestamps(subtractMonths(18));
      await hardhatLoan.setPaymentSchedule(tokenId1, paymentSchedule);

      // Transfer 500k tokens from owner to addr2 to account for profits to pay back loan + interest and to force owner balance to be 0
      await hardhatToken.transfer(owner, addr2, BigInt(500000) * BigInt(1e18), true, "0x");

      // Move time forward and pay off loan
      try {
        for (let i = 1; i < 36; i++) {
          await time.increaseTo(paymentSchedule[i]);
          await hardhatLoan.connect(addr2).makePayment(tokenId1);
        }
      } catch (error) {
        console.error(error);
      }
      expect(await hardhatLoan.connect(addr2).makePayment(tokenId1))
        .to.emit(hardhatLoan, "LoanRepayed");
    });
  });

  // LIQUIDATE LOAN tests
  describe("Liquidate Loan", function () {
    it("Should transfer the initialLoanAmount back to the lender", async function () {
      const { hardhatLoan, hardhatToken, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(initialLoanAmount);
      await hardhatLoan.connect(addr1).liquidiateLoan(tokenId1);
      expect(await hardhatToken.balanceOf(hardhatLoan.target) / BigInt(1e18)).to.equal(0);
    });

    it("Should emit LoanLiquidated event", async function () {
      const { hardhatLoan, owner, addr1, initialLoanAmount, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      expect(await hardhatLoan.connect(addr1).liquidiateLoan(tokenId1))
        .to.emit(hardhatLoan, "LoanLiquidated")
        .withArgs(owner, hardhatLoan.target, addr1, initialLoanAmount, true, '0x');
    });

    it("Should only allow the lender to liquidate the loan", async function () {
      const { hardhatLoan, owner, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await expect(hardhatLoan.connect(owner).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(owner.address);
      await expect(hardhatLoan.connect(addr2).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, 'Unauthorized').withArgs(addr2.address);
    });

    it("Should only allow lender to liquidate the loan before borrower accepts the loan", async function () {
      const { hardhatLoan, addr1, addr2, tokenId1 } = await loadFixture(deployLoanFixture);
      await hardhatLoan.connect(addr1).fundLoan(tokenId1);
      await hardhatLoan.setBorrower(tokenId1, addr2);
      await hardhatLoan.connect(addr2).acceptLoan(tokenId1);
      await expect(hardhatLoan.connect(addr1).liquidiateLoan(tokenId1)).to.be.revertedWithCustomError(hardhatLoan, "ActionNotAllowedInCurrentState");
    });
  });
});
// JS Libraries
const withData = require('leche').withData;
const { t, createMocks, NULL_ADDRESS } = require('../utils/consts');
const { escrowFactory } = require('../utils/events');
const assert = require('assert');

// Mock contracts
const Mock = artifacts.require("./mock/util/Mock.sol");

// Smart contracts
const Settings = artifacts.require("./base/Settings.sol");
const Escrow = artifacts.require("./base/Escrow.sol");
const EscrowFactory = artifacts.require("./base/EscrowFactory.sol");

contract('EscrowFactoryAddDAppTest', function (accounts) {
  const owner = accounts[0];
  let escrow;
  let instance;
  let mocks;

  beforeEach(async () => {
    escrow = await Escrow.new();
    instance = await EscrowFactory.new();
    const settings = await Settings.new();
    await settings.initialize(owner);
    await instance.initialize(settings.address, { from: owner });

    mocks = await createMocks(Mock, 10);
  })

  const getInstance = (refs, index, accountIndex) => index === -1 ? NULL_ADDRESS: index === 99 ? accounts[accountIndex] : refs[index];

  withData({
    _1_basic: [[1, 2], accounts[0], 3, false, null],
    _2_already_exist: [[3, 4], accounts[0], 4, true, 'DAPP_ALREADY_EXIST'],
    _3_invalid_empty_dapp_address: [[1, 2], accounts[0], -1, true, 'DAPP_ISNT_A_CONTRACT'],
    _4_not_pauser: [[1, 2], accounts[5], 3, true, 'NOT_PAUSER'],
  }, function(
    previousDaapIndexes,
    caller,
    dappIndex,
    mustFail,
    expectedErrorMessage
  ) {
    it(t('escrowFactory', 'addDapp', 'Should be able (or not) to add a new dapp.', mustFail), async function() {
      // Setup
      for (const previousDappIndex of previousDaapIndexes) {
        await instance.addDapp(getInstance(mocks, previousDappIndex, 1), { from: owner });
      }
      const dappAddress = getInstance(mocks, dappIndex, 2);

      try {
        // Invocation
        const result = await instance.addDapp(dappAddress, { from: caller });

        // Assertions
        assert(!mustFail, 'It should have failed because data is invalid.');
        assert(result);

        escrowFactory
          .newDAppAdded(result)
          .emitted(caller, dappAddress);

        const dapps = await instance.getDapps();
        const lastDapp = dapps[dapps.length - 1];
        assert.equal(lastDapp, dappAddress);

        const isDapp = await instance.isDapp(dappAddress);
        assert(isDapp);
      } catch (error) {
        assert(mustFail);
        assert(error);
        assert.equal(error.reason, expectedErrorMessage);
      }
    });
  });
});

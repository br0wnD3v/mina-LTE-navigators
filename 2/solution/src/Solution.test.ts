import {
  Mina,
  PrivateKey,
  AccountUpdate,
  Field,
  PublicKey,
  UInt64,
} from 'o1js';
import { Solution, Message, MessageDetails } from './Solution.js';

describe('Solution.js', () => {
  let deployer: PublicKey,
    deployerPK: PrivateKey,
    Local: any,
    zkAppAddress: PublicKey,
    zkAppKey: PrivateKey,
    solutionZkApp: Solution;

  beforeAll(async () => {
    Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);

    deployerPK = Local.testAccounts[0].privateKey;
    deployer = deployerPK.toPublicKey();

    zkAppKey = PrivateKey.random();
    zkAppAddress = zkAppKey.toPublicKey();

    solutionZkApp = new Solution(zkAppAddress);

    const txn = await Mina.transaction(deployer, () => {
      AccountUpdate.fundNewAccount(deployer);
      solutionZkApp.deploy({ zkappKey: zkAppKey });
    });
    await txn.prove();
    await txn.sign([deployerPK, zkAppKey]).send();
  });

  describe('Init', () => {
    it('Should set the default values for the storage variables.', async () => {
      const expected = Field.from(0).toString();

      const highestValueCommitment =
        solutionZkApp.HighestValidMessageId.get().toString();
      expect(highestValueCommitment).toEqual(expected);
    });
  });
  describe('Sending Messages.', () => {
    it('Shouldn`t update the highest since some condition fail.', async () => {
      for (let i = 1; i <= 50; i++) {
        const id: Field = Field.from(i);
        const agentId: UInt64 = UInt64.from(i);
        const positionX: UInt64 = UInt64.from(i);
        const positionY: UInt64 = UInt64.from(i);

        const details: MessageDetails = new MessageDetails({
          AgentID: agentId,
          AgentXLocation: positionX,
          AgentYLocation: positionY,
          CheckSum: agentId.add(positionX).add(positionY),
        });

        const message: Message = new Message({
          MessageNumber: id,
          Details: details,
        });

        const txn = await Mina.transaction(deployer, () => {
          solutionZkApp.receive(message);
        });
        await txn.prove();
        await txn.sign([deployerPK]).send();
      }

      const currentHightest =
        solutionZkApp.HighestValidMessageId.get().toString();
      const expected = Field.from(0).toString();

      expect(currentHightest).toEqual(expected);
    });
    it('Should update the highest when all is good.', async () => {
      const id: Field = Field.from(1000);
      const agentId: UInt64 = UInt64.from(10);
      const positionX: UInt64 = UInt64.from(2000);
      const positionY: UInt64 = UInt64.from(5000);

      const details: MessageDetails = new MessageDetails({
        AgentID: agentId,
        AgentXLocation: positionX,
        AgentYLocation: positionY,
        CheckSum: agentId.add(positionX).add(positionY),
      });

      const message: Message = new Message({
        MessageNumber: id,
        Details: details,
      });

      const txn = await Mina.transaction(deployer, () => {
        solutionZkApp.receive(message);
      });
      await txn.prove();
      await txn.sign([deployerPK]).send();

      const currentHightest =
        solutionZkApp.HighestValidMessageId.get().toString();
      const expected = id.toString();

      expect(currentHightest).toEqual(expected);
    });
  });
});

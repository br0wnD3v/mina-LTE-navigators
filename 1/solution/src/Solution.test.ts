import {
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleTree,
  MerkleMap,
  Field,
  Poseidon,
  PublicKey,
} from 'o1js';
import { Solution, MerkleTreeWitness } from './Solution.js';

describe('Solution.js', () => {
  let deployer: PublicKey,
    deployerPK: PrivateKey,
    Local: any,
    zkAppAddress: PublicKey,
    zkAppKey: PrivateKey,
    solutionZkApp: Solution,
    map: MerkleMap,
    tree: MerkleTree,
    salt: Field;

  async function addElement(
    salt: Field,
    index: bigint,
    key: Field,
    publicKey: PublicKey
  ) {
    let txn;

    tree.setLeaf(index, key);
    const treeWitness = new MerkleTreeWitness(tree.getWitness(index));

    txn = await Mina.transaction(deployer, () => {
      solutionZkApp.addAddress(salt, treeWitness, publicKey);
    });
    await txn.prove();
    await txn.sign([deployerPK]).send();
  }

  async function addMessage(
    index: bigint,
    key: Field,
    message: Field,
    publicKey: PublicKey,
    pk: PrivateKey
  ) {
    let txn;

    map.set(key, message);
    const mapWitness = map.getWitness(key);
    const treeWitness = new MerkleTreeWitness(tree.getWitness(index));

    txn = await Mina.transaction(publicKey, () => {
      solutionZkApp.addMessage(publicKey, treeWitness, message, mapWitness);
    });
    await txn.prove();
    await txn.sign([pk]).send();
  }

  beforeAll(async () => {
    Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);

    deployerPK = Local.testAccounts[0].privateKey;
    deployer = deployerPK.toPublicKey();

    zkAppKey = PrivateKey.random();
    zkAppAddress = zkAppKey.toPublicKey();

    await Solution.compile();

    solutionZkApp = new Solution(zkAppAddress);

    const txn = await Mina.transaction(deployer, () => {
      AccountUpdate.fundNewAccount(deployer);
      solutionZkApp.deploy({ zkappKey: zkAppKey });
    });
    await txn.prove();
    await txn.sign([deployerPK, zkAppKey]).send();

    map = new MerkleMap();
    tree = new MerkleTree(8);
    salt = Field.random();
  });

  describe('Init', () => {
    it('Should set the default values for the storage variables.', async () => {
      const expected = Field.from(0).toString();

      const addressCommitment = solutionZkApp.addressCommitment
        .get()
        .toString();
      expect(addressCommitment).toEqual(expected);

      const addressCounter = solutionZkApp.addressCounter.get().toString();
      expect(addressCounter).toEqual(expected);

      const messagesCommitment = solutionZkApp.messagesCommitment
        .get()
        .toString();
      expect(messagesCommitment).toEqual(expected);

      const messageCounter = solutionZkApp.messageCounter.get().toString();
      expect(messageCounter).toEqual(expected);

      const salt = solutionZkApp.salt.get().toString();
      expect(salt).toEqual(expected);
    });

    it('Should update the salt.', async () => {
      const txn = await Mina.transaction(deployer, () => {
        solutionZkApp.initSalt(salt);
      });
      await txn.prove();
      await txn.sign([deployerPK]).send();

      const updatedValue = solutionZkApp.salt.get().toString();
      const expected = Poseidon.hash([salt]).toString();

      expect(updatedValue).toEqual(expected);
    });
  });

  describe('Updating Storage', () => {
    describe('Address Tree ->', () => {
      it('Should fail adding address if the salt is incorrect.', async () => {
        const index = 0n;
        const pk = Local.testAccounts[1].privateKey;
        const address = pk.toPublicKey();
        const key = Poseidon.hash(address.toFields());
        const incorrectSalt = Field.random();
        tree.setLeaf(index, key);
        const treeWitness = new MerkleTreeWitness(tree.getWitness(index));

        try {
          const txn = await Mina.transaction(deployer, () => {
            solutionZkApp.addAddress(incorrectSalt, treeWitness, address);
          });
          await txn.prove();
          await txn.sign([deployerPK]).send();
        } catch (error: any) {
          expect(error.message).toContain(
            'Account_app_state_precondition_unsatisfied'
          );
        }
      });

      it('Should add an address and update the counter.', async () => {
        const index = 0n;
        const pk = Local.testAccounts[1].privateKey;
        const address = pk.toPublicKey();
        const key = Poseidon.hash(address.toFields());

        await addElement(salt, index, key, address);

        const expected = Field.from(1).toString();
        const addressCounter = solutionZkApp.addressCounter.get().toString();
        expect(addressCounter).toEqual(expected);
      });
    });

    describe('Message Map ->', () => {
      it("Should fail adding a message if the address doesn't exist in the tree.", async () => {
        let index = 0n;
        const pk = Local.testAccounts[2].privateKey;
        const address = pk.toPublicKey();
        const key = Poseidon.hash(address.toFields());
        const message = Field.from(0b000111010101000000);

        try {
          await addMessage(index, key, message, address, pk);
        } catch (error: any) {
          expect(error.message).toContain('Field.assertEquals()');
        }

        index = index + 1n;
        try {
          await addMessage(index, key, message, address, pk);
        } catch (error: any) {
          expect(error.message).toContain('Field.assertEquals()');
        }
      });

      it('Should fail adding a message if the none of the required flag conditions are met.', async () => {
        const index = 0n;
        const pk = Local.testAccounts[1].privateKey;
        const address = pk.toPublicKey();
        const key = Poseidon.hash(address.toFields());
        const message = Field.from(0b000111010101000000);

        try {
          await addMessage(index, key, message, address, pk);
        } catch (error: any) {
          expect(error.message).toContain('false != true');
        }
      });

      it('Should add a message if address exists in the tree, update the counter and emit events.', async () => {
        const index = 0n;
        const pk = Local.testAccounts[1].privateKey;
        const address = pk.toPublicKey();
        const key = Poseidon.hash(address.toFields());
        const message = Field.from(0b000111010101100000);

        await addMessage(index, key, message, address, pk);

        const expected = Field.from(1).toString();
        const messageCounter = solutionZkApp.messageCounter.get().toString();
        expect(messageCounter).toEqual(expected);

        const events = await solutionZkApp.fetchEvents();
        const addressEventValue = events[0].event.data;
        const messageEventValue = events[1].event.data;

        expect(addressEventValue).toEqual(address);
        expect(messageEventValue).toEqual(message);
      });
    });
  });
});

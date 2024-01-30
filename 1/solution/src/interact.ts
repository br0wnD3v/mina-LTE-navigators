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

const tree = new MerkleTree(8);
const map = new MerkleMap();
const salt = Field.random();

const Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);
const deployerPK = Local.testAccounts[0].privateKey;
const deployer = deployerPK.toPublicKey();

function getCounters(solution: Solution) {
  console.log('Address Counter :', solution.addressCounter.get().toString());
  console.log('Message Counter :', solution.messageCounter.get().toString());
}

async function addElement(
  solution: Solution,
  index: bigint,
  key: Field,
  message: Field,
  publicKey: PublicKey,
  pk: PrivateKey
) {
  let txn;

  tree.setLeaf(index, key);
  const treeWitness = new MerkleTreeWitness(tree.getWitness(index));

  txn = await Mina.transaction(deployer, () => {
    solution.addAddress(salt, treeWitness, publicKey);
  });
  console.log(`\nAdding address ${publicKey.toBase58()} to the tree`);
  await txn.prove();
  await txn.sign([deployerPK]).send();

  map.set(key, message);
  const mapWitness = map.getWitness(key);

  txn = await Mina.transaction(publicKey, () => {
    solution.addMessage(publicKey, treeWitness, message, mapWitness);
  });
  console.log(`Adding message by address ${publicKey.toBase58()}`);
  await txn.prove();
  await txn.sign([pk]).send();
  getCounters(solution);
}

const zkAppPK = PrivateKey.random();
const zkApp = zkAppPK.toPublicKey();

await Solution.compile();
const solution = new Solution(zkApp);

let txn;

txn = await Mina.transaction(deployer, async () => {
  AccountUpdate.fundNewAccount(deployer);
  solution.deploy({ zkappKey: zkAppPK });
});
console.log('\nDeploying Solution');
await txn.prove();
await txn.sign([deployerPK, zkAppPK]).send();
console.log('Deployed =========');

txn = await Mina.transaction(deployer, () => {
  solution.initSalt(salt);
});
console.log('Setting salt');
await txn.prove();
await txn.sign([deployerPK]).send();

const pk_1 = Local.testAccounts[1].privateKey;
const address_1 = pk_1.toPublicKey();
const key_1 = Poseidon.hash(address_1.toFields());
const message_1 = Field.from(0b000111010101100000);

const pk_2 = Local.testAccounts[2].privateKey;
const address_2 = pk_2.toPublicKey();
const key_2 = Poseidon.hash(address_2.toFields());
const message_2 = Field.from(0b011000100011000);

const pk_3 = Local.testAccounts[3].privateKey;
const address_3 = pk_3.toPublicKey();
const key_3 = Poseidon.hash(address_3.toFields());
const message_3 = Field.from(0b1110000000000100);

await addElement(solution, 0n, key_1, message_1, address_1, pk_1);
await addElement(solution, 1n, key_2, message_2, address_2, pk_2);
await addElement(solution, 2n, key_3, message_3, address_3, pk_3);

console.log('\n');

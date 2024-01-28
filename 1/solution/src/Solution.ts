import {
  method,
  SmartContract,
  state,
  State,
  Field,
  UInt8,
  PublicKey,
  Poseidon,
  MerkleWitness,
  MerkleMap,
  Gadgets,
  Provable,
  Bool,
} from 'o1js';

class AddressWitness extends MerkleWitness(8) {}

export class Solution extends SmartContract {
  @state(Field) addressCommitment = State<Field>();
  @state(Field) messagesCommitment = State<Field>();
  @state(UInt8) counter = State<UInt8>();
  @state(Field) salt = State<Field>();

  init() {
    super.init();
  }

  @method initSalt(salt: Field) {
    this.salt.getAndRequireEquals();
    this.salt.requireEquals(Poseidon.hash([Field.from(0)]));

    this.salt.set(Poseidon.hash([salt]));
  }

  // @method initTree(commitment: Field, salt: Field) {
  //   this.addressCommitment.getAndRequireEquals();
  //   this.salt.getAndRequireEquals();

  //   this.salt.requireEquals(Poseidon.hash([salt]));

  //   this.addressCommitment.set(commitment);
  // }

  // @method initMap(commitment: Field, salt: Field) {
  //   this.messagesCommitment.getAndRequireEquals();
  //   this.salt.getAndRequireEquals();

  //   this.salt.requireEquals(Poseidon.hash([salt]));

  //   this.messagesCommitment.set(commitment);
  // }

  @method addAddress(
    sentSalt: Field,
    addressWitness: AddressWitness,
    address: PublicKey
  ) {
    this.salt.getAndRequireEquals();
    this.addressCommitment.getAndRequireEquals();
    this.messagesCommitment.getAndRequireEquals();
    this.counter.getAndRequireEquals();

    // Limit of 100
    this.counter.get().assertLessThan(UInt8.from(100));
    // Only to be changed by the admin.
    this.salt.requireEquals(Poseidon.hash([sentSalt]));

    const updatedCommitment = addressWitness.calculateRoot(
      Poseidon.hash(address.toFields())
    );
    this.addressCommitment.set(updatedCommitment);
  }

  @method addMessage(
    address: PublicKey,
    addressWitness: AddressWitness,
    message: Field,
    messageMap: MerkleMap
  ) {
    this.salt.getAndRequireEquals();
    this.messagesCommitment.getAndRequireEquals();
    this.addressCommitment.getAndRequireEquals();
    this.counter.getAndRequireEquals();

    const key = Poseidon.hash(address.toFields());
    const calculatedCommitment = addressWitness.calculateRoot(key);

    this.addressCommitment.get().assertEquals(calculatedCommitment);

    messageMap.get(key).assertNotEquals(Field.from(0));

    const valid_1 = Gadgets.and(message, Field.from(0b100000), 6).equals(
      Field.from(0b100000)
    );
    const valid_2 = Gadgets.and(message, Field.from(0b011000), 6).equals(
      Field.from(0b011000)
    );
    const valid_3 = Gadgets.and(message, Field.from(0b001000), 6).equals(
      Field.from(0b011000)
    );

    const validMessage = Provable.if(
      valid_1 || valid_2 || valid_3,
      Bool(true),
      Bool(false)
    );
    validMessage.assertTrue();

    messageMap.set(key, message);
    const updatedMessagesCommitment = messageMap.getRoot();

    this.messagesCommitment.set(updatedMessagesCommitment);
  }
}

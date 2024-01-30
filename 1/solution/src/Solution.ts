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
  Gadgets,
  Provable,
  Bool,
  MerkleMapWitness,
  UInt64,
} from 'o1js';

export class MerkleTreeWitness extends MerkleWitness(8) {}

export class Solution extends SmartContract {
  @state(Field) addressCommitment = State<Field>();
  @state(Field) messagesCommitment = State<Field>();
  @state(UInt8) addressCounter = State<UInt8>();
  @state(UInt64) messageCounter = State<UInt64>();
  @state(Field) salt = State<Field>();

  events = {
    'message-received': Field,
    sender: PublicKey,
  };

  init() {
    super.init();
  }

  @method initSalt(salt: Field) {
    this.salt.getAndRequireEquals();
    this.salt.requireEquals(Field.from(0));

    this.salt.set(Poseidon.hash([salt]));
  }

  @method addAddress(
    sentSalt: Field,
    addressWitness: MerkleTreeWitness,
    address: PublicKey
  ) {
    this.salt.getAndRequireEquals();
    this.addressCommitment.getAndRequireEquals();
    this.messagesCommitment.getAndRequireEquals();
    this.addressCounter.getAndRequireEquals();

    // Limit of 100
    this.addressCounter.get().assertLessThan(UInt8.from(100));
    // Only to be changed by the admin.
    this.salt.requireEquals(Poseidon.hash([sentSalt]));

    const updatedCommitment = addressWitness.calculateRoot(
      Poseidon.hash(address.toFields())
    );
    this.addressCounter.set(this.addressCounter.get().add(UInt8.from(1)));
    this.addressCommitment.set(updatedCommitment);
  }

  @method getLast6Bits(message: Field): Field {
    const last6Bits = Gadgets.and(message, Field.from(0b111111), 32);
    return last6Bits;
  }

  @method addMessage(
    address: PublicKey,
    addressWitness: MerkleTreeWitness,
    message: Field,
    messageWitness: MerkleMapWitness
  ) {
    this.salt.getAndRequireEquals();
    this.messageCounter.getAndRequireEquals();
    this.messagesCommitment.getAndRequireEquals();
    this.addressCommitment.getAndRequireEquals();

    const addressKey = Poseidon.hash(address.toFields());
    const calculatedAddressCommitment =
      addressWitness.calculateRoot(addressKey);

    this.addressCommitment.get().assertEquals(calculatedAddressCommitment);

    const [messageMapUpdatedCommitment, messageKey] =
      messageWitness.computeRootAndKey(message);

    messageKey.assertEquals(addressKey);

    const last6Bits = Gadgets.and(message, Field.from(0b111111), 32);
    const valid_1 = last6Bits.equals(Field.from(0b100000));
    const valid_2 = last6Bits.equals(Field.from(0b11000));
    const valid_3 = last6Bits.equals(Field.from(0b100));

    const validMessage = Provable.switch([valid_1, valid_2, valid_3], Bool, [
      valid_1,
      valid_2,
      valid_3,
    ]);
    validMessage.assertTrue();

    this.messageCounter.set(this.messageCounter.get().add(UInt64.from(1)));
    this.messagesCommitment.set(messageMapUpdatedCommitment);

    this.emitEvent('message-received', message);
    this.emitEvent('sender', address);
  }
}

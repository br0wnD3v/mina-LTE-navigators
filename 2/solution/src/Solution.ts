import {
  SmartContract,
  State,
  state,
  Field,
  Struct,
  method,
  Bool,
  UInt64,
  Provable,
} from 'o1js';

export class MessageDetails extends Struct({
  AgentID: UInt64,
  AgentXLocation: UInt64,
  AgentYLocation: UInt64,
  CheckSum: UInt64,
}) {}

export class Message extends Struct({
  MessageNumber: Field,
  Details: MessageDetails,
}) {}

export class Solution extends SmartContract {
  @state(Field) HighestValidMessageId = State<Field>();

  init() {
    super.init();
    this.HighestValidMessageId.set(Field.from(0));
  }

  @method receive(message: Message) {
    const currH = this.HighestValidMessageId.getAndRequireEquals();

    const validMessage: Bool = this.validateMessage(message);
    const currMID = message.MessageNumber;

    const toSet: Field = Provable.if(
      currMID.greaterThan(currMID).and(validMessage),
      currMID,
      currH
    );

    this.HighestValidMessageId.set(toSet);
  }

  @method validateMessage(message: Message): Bool {
    const currentAgent: UInt64 = message.Details.AgentID;
    const currentX: UInt64 = message.Details.AgentXLocation;
    const currentY: UInt64 = message.Details.AgentYLocation;
    const CheckSum: UInt64 = message.Details.CheckSum;

    const validAgent: Bool = currentAgent
      .greaterThanOrEqual(UInt64.from(0))
      .and(currentAgent.lessThanOrEqual(UInt64.from(3000)));

    const validX: Bool = currentX
      .greaterThanOrEqual(UInt64.from(0))
      .and(currentX.lessThanOrEqual(UInt64.from(15000)));

    const validY: Bool = currentY
      .greaterThanOrEqual(UInt64.from(5000))
      .and(currentY.lessThanOrEqual(UInt64.from(20000)));

    const validChecksum: Bool = CheckSum.equals(
      currentAgent.add(currentX).add(currentY)
    );
    const validXYRelation: Bool = currentY.greaterThan(currentX);

    const valid_1: Bool = Bool(currentAgent.equals(UInt64.from(0)));
    const valid_2: Bool = validAgent
      .and(validX)
      .and(validY)
      .and(validChecksum)
      .and(validXYRelation);
    const valid: Bool = valid_1.or(valid_2);

    return valid;
  }
}

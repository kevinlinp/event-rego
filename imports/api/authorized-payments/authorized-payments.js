import { Mongo } from 'meteor/mongo';

export const AuthorizedPayments = new Mongo.Collection('authorizedPayments');

AuthorizedPayments.schema = new SimpleSchema({
  status: {type: String, defaultValue: 'pending', allowedValues: ['pending', 'completed']},
  paymentId: {type: String},
  payerId: {type: String},
  amount: {type: Number},
  createdAt: {type: Date, autoValue: () => {
    return Date.new();
  }}
});

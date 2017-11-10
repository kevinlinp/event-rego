import { Meteor } from 'meteor/meteor';
import { Promise } from 'meteor/promise';
import { check } from 'meteor/check';

import { Events } from '../events/events.js';
import { People } from '../people/people.js';
import { Payments } from '../payments/payments.js';
import { AuthorizedPaymentItems } from '../authorized-payment-items/authorized-payment-items.js';

const paypalClient = (paypal) => {
  let env = new paypal.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
  return new paypal.PayPalHttpClient(env);
}

const paymentObj = function(event, person) {
  const itemName = `Hash cash: ${event.name.substring(0, 59)} (${person.name.substring(0, 39)})`

  const items = [
    {
      name: itemName,
      quantity: 1,
      price: event.cashAmount,
      currency: 'USD',
      sku: `${event._id}-${person._id}`
    },
    {
      name: 'handling fee',
      quantity: 1,
      price: event.paypalFee(),
      currency: 'USD',
      sku: `fee`
    }
  ];

  return {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: 'http://localhost:3000/events',
      cancel_url: 'http://localhost:3000/events'
    },
    transactions: [{
      amount: {
        currency: 'USD',
        total: event.paypalTotal(),
      },
      item_list: {
        items: items
      }
    }]
  };
};

const fetchObjects = (eventId, personId) => {
  return {
    event: Events.findOne(eventId),
    person: People.findOne(personId)
  };
}

Meteor.methods({
  'paypal.createPayment'(eventId, personId) {
    const { event, person } = fetchObjects(eventId, personId);

    const paypal = require('paypal-rest-sdk');
    const client = paypalClient(paypal);

    let request = new paypal.PaymentCreateRequest();
    request.requestBody(paymentObj(event, person));

    const response = Promise.await(client.execute(request));
    const payment = response.result;

    const paymentDoc = {
      paymentId: payment.id,
      data: payment
    };

    Payments.schema.clean(paymentDoc);
    Payments.schema.validate(paymentDoc);

    const rawPayments = Payments.rawCollection();
    const syncInsert = Meteor.wrapAsync(rawPayments.insert, rawPayments);
    syncInsert(paymentDoc);

    return payment.id;
  },

  'paypal.authorizePayment'(paymentId, payerId) {
    const paymentDoc = Payments.findOne({paymentId: paymentId});
    if (paymentDoc.status != 'created') {
      return;
    }
    const payment = paymentDoc.data;

    let items = payment.transactions[0].item_list.items;
    if (items.length != 2) {
      return null;
    }

    items = _.reject(items, (item) => {
      return (item.sku == 'fee');
    });

    let item = items[0];
    const [eventId, personId] = item.sku.split('-');
    const { event, person } = fetchObjects(eventId, personId);
    let authorizedPaymentItem = {
      eventId: event._id,
      personId: person._id,
      paymentId: paymentId
    }

    AuthorizedPaymentItems.schema.clean(authorizedPaymentItem);
    AuthorizedPaymentItems.schema.validate(authorizedPaymentItem);
    const authorizedPaymentId = AuthorizedPaymentItems.insert(authorizedPaymentItem); // atomicity guaranteed here

    if (!authorizedPaymentId) {
      return null;
    }

    const paypal = require('paypal-rest-sdk');
    const client = paypalClient(paypal);

    const request = new paypal.PaymentExecuteRequest(paymentId);
    request.requestBody({payer_id: payerId});
    const response = Promise.await(client.execute(request));

    console.log(response);
    console.log(response.result);
  },
});

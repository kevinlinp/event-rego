import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Events } from './events.js';

Meteor.methods({
  'events.insert'(fields) {
    var friendlyUrl = require('friendly-url');
    var chrono = require('chrono-node');

    fields.startsAt = chrono.parseDate(fields.startsAt);
    fields.friendlyId = friendlyUrl(fields.name);

    Events.schema.clean(fields);
    Events.schema.validate(fields);

    return Events.insert(fields);
  },

  'events.remove'(id) {
    return Events.remove({_id: id});
  },
});


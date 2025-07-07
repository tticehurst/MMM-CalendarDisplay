const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");
const { rrulestr } = require("rrule");

function PRIVATE_FormatEpoch24HourTime(epochTimestamp) {
  return new Date(epochTimestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

module.exports = NodeHelper.create({
  async socketNotificationReceived(notification, payload) {
    if (notification === "GET_EVENTS") {
    }
  }
});

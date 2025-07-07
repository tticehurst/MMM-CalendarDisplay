const NodeHelper = require("node_helper");
const Bent = require("bent");
const ICal = require("node-ical");
const { rrulestr } = require("rrule");
const e = require("express");

const BentGetString = Bent("string");

// Private function to take Epoch timestamp and return it as a 24-hour time string
function PRIVATE_FormatEpoch24HourTime(epochTimestamp) {
  // Creates a new date object from the epoch timestamp and sets it to a locale timestring with no locale set - this will use the system locale
  return new Date(epochTimestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

// Private function to get the start and end dates of the current week to be displayed
// This means that if it was Monday we will see Monday -> Sunday
// If it was Tuesday we will see Tuesday -> Monday
// etc
function PRIVATE__GetDateRange(daysToDisplay, now) {
  const startDate = new Date(now);
  let endDate;

  if (daysToDisplay === "month") {
    // If the days to display is "month", we will set the start date to the first day of the current month
    startDate.setDate(1);
    // Set the hours to 00:00:00 to ensure we are working with the start of the day
    startDate.setHours(0, 0, 0, 0);

    // Set the end date to the last day of the current month
    // This is done by creating a new date object with the current year and month, and setting the date to 0
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    // Set the hours to 23:59:00 to ensure we are working up to the end of the day
    endDate.setHours(23, 59, 0, 0);
  } else {
    // Set the end date to the current date so it can be modified
    endDate = new Date(now);
    // Set the end date to 7 days in the future based from the current end date (which will always start as the start date)
    endDate.setDate(endDate.getDate() + daysToDisplay - 1);
    // Set the end hours to 23:59:00 and the start hours to 00:00:00
    // This is so that the end date will always be the end of the day to include calendar events that go over multiple days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 0, 0);
  }

  return [startDate, endDate];
}

module.exports = NodeHelper.create({
  // Start function to run when the module is loaded on the server side
  start() {
    console.log("CAL LOADED - SERVER SIDE");
  },

  NormaliseEventData(eventData) {},
  // A public function to get the events between two dates and perform filtering based on predefined rules
  // I.E: It must be of type 'VEVENT' and have a start and end date
  async GetEventsBetweenDates(urls, startDate, endDate, now) {
    let debugsend = "no debug send";
    // Await all the calendar URLs to be fetched using Promise.all and Bent
    const calendarResponses = await Promise.all(
      urls.map((url) => BentGetString(url))
    );
    // Then map these into a new array of ical data
    const iCalData = calendarResponses.map((response) =>
      ICal.parseICS(response)
    );

    // Loop through each ical and its raw data and filter out the events that are not of type 'VEVENT' or do not have a start and end date
    for (const data of iCalData) {
      // Filter the data so it only contains actual calendar events

      const VEVENTs = Object.values(data).filter(
        (eventData) =>
          eventData.type === "VEVENT" &&
          eventData.end >= startDate &&
          eventData.start <= endDate
      );

      const VEVENTsNotRRULE = VEVENTs.filter((eventData) => !eventData.rrule);

      // Filter the events further to find those that reoccur using rrules
      // This will then be flatmapped to create a new array of events that fall within the date range given to the function
      const VEVENTsRRULE = VEVENTs.filter(
        (eventData) => eventData.rrule
      ).flatMap((eventData) => {
        const rule = rrulestr(eventData.rrule.toString());
        const dateRange = rule.all().map((date) => date.toUTCString());
        const newArray = [];

        console.log(dateRange);
        // TODO - Loop through date range and manually add the reoccuring event to the array
        // ! For each entry in the filter duplicate it as many times as in the date range, setting start and end accordingly
        return newArray;
      });

      console.log(VEVENTsRRULE);
    }

    // TODO - Remove this debug log once the module is stable
    this.sendSocketNotification("debug", debugsend);
  },

  // Listens for a socket notification from the client side
  // Must be async because web requests must be awaited
  async socketNotificationReceived(notification, payload) {
    // We check the notification in case of a rogue module sending a notification
    // If the notification is "GET_EVENTS", we continue otherwise we ignore it
    if (notification === "GET_EVENTS") {
      // Array to store any collected events - reset each notification to keep them up-to-date
      const collectedEvents = [];
      // Get the date and time right now - relative to when the notificaiton is recieved
      const now = new Date();
      // Set the time to 00:00:00.000Z to ensure we are working with the start of the day
      now.setHours(0, 0, 0, 0);
      // Store the current days in the month as we will use this as a cap for the events we're grabbing
      const daysInCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

      // We will also use this to determine if the days to display is valid and set it to the maximum if it is not
      if (
        !payload.daysToDisplay ||
        payload.daysToDisplay > daysInCurrentMonth
      ) {
        payload.daysToDisplay = daysInCurrentMonth;
      }

      // Get the start and end dates of the current week based on the days to display
      const [toDisplayStart, toDisplayEnd] = PRIVATE__GetDateRange(
        payload.daysToDisplay,
        now
      );
      // Get the start and end date for the current month
      // This is so we can make use of the addon module to display a heatmap for all a month's events
      const [monthStart, monthEnd] = PRIVATE__GetDateRange("month", now);

      // Run a function to get the events between the start and end dates
      const thisWeeksEvents = this.GetEventsBetweenDates(
        payload.urls,
        toDisplayStart,
        toDisplayEnd,
        now
      );
    }
  }
});

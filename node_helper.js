/**
 * MMM-CalendarDisplay
 * A MagicMirror module that displays calendar events in a calendar format.
 *
 * Keywords:
 *  PRIVATE : This is a private function and should not be used outside of this module.
 *
 * Author:
 *  Tom Ticehurst
 */

const NodeHelper = require("node_helper");
const Bent = require("bent");
const ICal = require("node-ical");
const { rrulestr } = require("rrule");

const BentGetString = Bent("string");

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

function PRIVATE__GetFullDateRange(startDate, endDate) {
  // Empty array that will store the dates in the range provided
  const datesArray = [];
  // Get the current date as the start date - we convert this so we don't touch the provided start date object
  const currentDate = new Date(startDate);

  // Loop while the current date is less than the end date provided by the user
  while (currentDate <= endDate) {
    // Push the date to the array and add one day on to the current date so the loop iterates
    // We make this a new date so we can preserve it and not change it on the next iteration
    datesArray.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Return the array of dates
  return datesArray;
}

function PRIVATE__GetNextWeekend(now) {
  // Create a new date object for the next Saturday and Sunday based on the current date
  const nextSaturday = new Date(now);
  // Set the date to the next Saturday by adding the difference between the current day and Saturday (6)
  nextSaturday.setDate(now.getDate() + ((6 - now.getDay()) % 7));
  // Set the hours to 00:00:00 to ensure we are working with the start of the day
  const nextSunday = new Date(nextSaturday);
  // Set the date to the next Sunday by adding one day to the next Saturday
  nextSunday.setDate(nextSaturday.getDate() + 1);

  // Return both dates
  return [nextSaturday, nextSunday];
}

module.exports = NodeHelper.create({
  // Start function to run when the module is loaded on the server side
  start() {
    console.log("CAL LOADED - SERVER SIDE");
  },

  // A public function to get the events between two dates and perform filtering based on predefined rules
  // I.E: It must be of type 'VEVENT' and have a start and end date
  async GetEventsBetweenDates(calendars, startDate, endDate) {
    // Map the calendars to an array of URLs
    const urls = calendars.map((cal) => cal.url);
    // Map the calendars to an array of styles
    const styles = calendars.map((cal) => cal.styles);

    // Await all the calendar URLs to be fetched using Promise.all and Bent
    const calendarResponses = await Promise.all(
      urls.map((url) => BentGetString(url))
    );

    // Then map these into a new array of ical data
    const iCalData = calendarResponses.map((response) =>
      ICal.parseICS(response)
    );

    // For each iCal data object we will add the styles from the styles array
    iCalData.forEach((data, index) => {
      // Set to the style in the config otherwise set to an empty string
      data["styles"] = styles[index] || "";
    });

    // Array to store all events from all calenders so it can be send back to the client
    const allEvents = [];

    // Loop through each ical and its raw data and filter out the events that are not of type 'VEVENT' or do not have a start and end date
    for (const data of iCalData) {
      // Filter the data so it only contains actual calendar events between our start and end dates
      const VEVENTs = Object.values(data)
        .filter(
          (eventData) =>
            eventData.type === "VEVENT" &&
            eventData.end >= startDate &&
            eventData.start <= endDate
        )
        .map((eventData) => {
          // Map to the existing event data as well as our piece of custom style data
          // This will let it be attached to events for the client to interpret
          return { ...eventData, styles: data.styles };
        });

      // Filter out any non recurring events (aka any that do not have an rrule attribute)
      const VEVENTsNotRRULE = VEVENTs.filter((eventData) => !eventData.rrule);

      // Filter the events further to find those that reoccur using rrules
      // This will then be flatmapped to create a new array of events that fall within the date range given to the function
      const VEVENTsRRULE = VEVENTs.filter(
        (eventData) => eventData.rrule
        // Flatmap so it doesn't return as a 2d array, we want a 1d array of objects like the origianl VEVENTs object
      ).flatMap((eventData) => {
        // Turn the rule into a rrule object using the rrulestr function
        const rrule = rrulestr(eventData.rrule.toString());
        // Take the date range of the rule and map it to an array of dates
        let dateRange = rrule.all().map((date) => date.toDateString());
        // New array to store the new VEVENTs that we will create based on the date range
        const newVEVENTs = [];

        // If an event has date exclusions process them here
        if (eventData.exdate) {
          // We create a new set for excluded dates, this ensures no duplicates and allows for faster lookups compared to an array
          const excludeDates = new Set(
            // Map each key to the date string formatted to a date to be on-par with the existing rrule dates
            // For some reason it always returns one day in the past so we add a day so it's the actual day the event has been excluded for
            Object.keys(eventData.exdate).map((dateStr) => {
              // Create a new date object from the date string
              const date = new Date(dateStr);

              // If the event is all day add one day because otherwise it will be one day in the past
              if (eventData.datetype === "date") {
                date.setDate(date.getDate() + 1);
              }

              // Return as a date string
              return date.toDateString();
            })
          );

          // Filter out dates in dateRange that are in excludeDates
          dateRange = dateRange.filter((d) => !excludeDates.has(d));
        }

        // Loop throgh each date
        dateRange.forEach((date) => {
          // Create a new deep clone of the event data to avoid touching the original
          const newEventData = structuredClone(eventData);

          // Create a new start date object
          const newStartDate = new Date(date);
          // Set the time to the same time as the original start date - we only want to touch the date not the actual time
          newStartDate.setHours(eventData.start.getHours());
          newStartDate.setMinutes(eventData.start.getMinutes());

          // Create a new end date object
          const newEndDate = new Date(date);
          // Set the time to the same time as the original start date - we only want to touch the date not the actual time
          newEndDate.setHours(eventData.end.getHours());
          newEndDate.setMinutes(eventData.end.getMinutes());

          // Overwrite the start and end dates of the new event data with the new start and end dates
          newEventData.start = newStartDate;
          newEventData.end = newEndDate;

          // Push the new event data to the newVEVENTs array
          newVEVENTs.push(newEventData);
        });

        // Return the newVEVENTs array so it can be used in the flatmap
        return newVEVENTs;
      });

      // Push both the events without an rrule and the ones with an rrule to the allEvents array, spreading so it's a 1d array
      allEvents.push(...VEVENTsNotRRULE, ...VEVENTsRRULE);
    }

    // Return this array
    return allEvents;
  },

  // Listens for a socket notification from the client side
  // Must be async because web requests must be awaited
  async socketNotificationReceived(notification, payload) {
    // We check the notification in case of a rogue module sending a notification
    // If the notification is "GET_EVENTS", we continue otherwise we ignore it
    if (notification === "GET_EVENTS") {
      // Get the date and time right now - relative to when the notificaiton is recieved
      const now = new Date();
      // Set the time to 00:00:00.000Z to ensure we are working with the start of the day
      now.setHours(0, 0, 0, 0);

      // Store the current days in the month as we will use this as a cap for the events we're grabbing
      // We do +1 on getMonth because day 0 will actually give us the last day of last month because javascript is weird like that
      const daysInCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

      // We will also use this to determine if the days to display is valid and set it to the maximum if it is not
      if (
        // If it's not valid just set to the days in the current month because that way it should be clear to the user and fuck it
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
      const thisWeeksEvents = await this.GetEventsBetweenDates(
        payload.calendars,
        toDisplayStart,
        toDisplayEnd
      );

      // Run a function to get the events for the current month
      const thisMonthsEvents = await this.GetEventsBetweenDates(
        payload.calendars,
        monthStart,
        monthEnd
      );

      // Send a socket notification of all events in the "week" - we know this might not be a week but we're deciding that whatever the user displays we are calling a week. 🤷🏽‍♀️
      this.sendSocketNotification("SEND_EVENTS_WEEK", {
        // Set the weekend to the next weekend dates. This is used to highlight the weekend in the tempalte
        weekend: PRIVATE__GetNextWeekend(now),
        // Set the events to the events key
        events: thisWeeksEvents,
        // Create an array of dates with a few modifications to how it is displayed to do minimal processing on the client side
        days: PRIVATE__GetFullDateRange(toDisplayStart, toDisplayEnd).map(
          (date) => {
            // Get the weekday, day and month from the date in the formats we want
            const [weekday, day, month] = date
              .toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "2-digit"
              })
              .split(" ");

            // Return this as well as the full day aka "02/07/2025" or "07/02/2025" depending on the locale
            // We set the hours to 00:00:00 because they're not important and we dont want the date to change depending on locale if they are too close to the other border
            return {
              weekday,
              day,
              month,
              full: new Date(date.setHours(0, 0, 0, 0)).toLocaleDateString()
            };
          }
        )
      });
    }
  }
});

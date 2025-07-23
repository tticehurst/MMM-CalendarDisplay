// Client side

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

Module.register("MMM-CalendarDisplay", {
  defaults: {
    // An array of calendar objects that will be used to style and grab ical information
    calendars: [],
    // The amount of days to fetch display on the calendar
    // This will not change how many are fetched because of the addon module
    // only how many days are rendered and displayed onto the calendar itself
    daysToDisplay: 7,
    // 10 minute default refresh timer in milliseconds, just because of how many events it may have to process and the unlikely chance of it changing that often
    refreshTime: 600000
  },

  // Private function - check valid URL
  PRIVATE_isValidUrl(url) {
    // Run a try-catch block to validate the URL
    try {
      // Attempt to create a new URL object with the provided URL
      new URL(url);
      // If the URL is valid, return true
      return true;
    } catch (e) {
      // If an error is thrown, the URL is invalid, so return false
      return false;
    }
  },

  // Private function to take Epoch timestamp and return it as a 24-hour time string
  PRIVATE_FormatTimestampTo24Hour(timestamp) {
    // Creates a new date object from the epoch timestamp and sets it to a locale timestring with no locale set - this will use the system locale
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  },

  // Start function - This is run when the module loads on the client side
  start() {
    console.log("CAL LOADED - CLIENT SIDE");

    if (
      !Array.isArray(this.config.calendars) ||
      this.config.calendars.length <= 0
    ) {
      console.error(
        "MMM-CalendarDisplay: No calendars configured. Please add at least one calendar to the config."
      );
      return;
    }

    // Validate each calendar URL in the config
    // If the URL is invalid, log an error to the console
    this.config.calendars.forEach((cal) => {
      // Checks to make sure there is a URL, then validates it. If either fail then raise an error
      if (!cal.url || !this.PRIVATE_isValidUrl(cal.url)) {
        // Raise an error
        console.error(
          `MMM-CalendarDisplay: Invalid URL for calendar ${cal.name}: ${cal.url || "None"}`
        );
      }
    });

    this.nunjucksEnvironment().addFilter("formatTime24", (timestamp) => {
      return this.PRIVATE_FormatTimestampTo24Hour(timestamp);
    });

    this.nunjucksEnvironment().addFilter("getEventsForDay", (day) => {
      return this.events.filter((event) => {
        return (
          new Date(event.end).toLocaleDateString() === day ||
          new Date(event.start).toLocaleDateString() === day
        );
      });
    });

    this.nunjucksEnvironment().addFilter("getStylesForEvent", (event) => {
      return this.config.calendars.find((cal) => cal.url == event.calUrl);
    });

    // Use the integrated "sendSocketNotification" function to send a notification to the server using calendars from the config as a payload
    // Map the urls object to an array of URLs
    // Also send over the days to display so the server can perform validation
    this.sendSocketNotification("GET_EVENTS", {
      calendars: this.config.calendars,
      daysToDisplay: this.config.daysToDisplay
    });

    // Set an interval to refresh the events every X minutes depending what the user sets in config
    setInterval(() => {
      this.sendSocketNotification("GET_EVENTS", {
        calendars: this.config.calendars,
        daysToDisplay: this.config.daysToDisplay
      });
    }, this.config.refreshTime);
  },

  // This function is called when the server sends a notification to the client
  // Contains the notification string and any data under the payload
  socketNotificationReceived(notification, payload) {
    if (notification === "SEND_EVENTS_WEEK") {
      this.nextSaturday = payload.weekend[0];
      this.nextSunday = payload.weekend[1];
      this.events = payload.events;
      this.days = payload.days;

      this.updateDom();
    }

    if (notification === "debug") {
      this.debug = payload;

      this.updateDom();
    }
  },

  // This returns the template file that will be used to render the module
  getTemplate() {
    return "CalendarDisplay.njk";
  },

  // This returns the styles that will be used to style the module
  getStyles() {
    return ["CalendarDisplay.css"];
  },

  // This passes through any data to the template from 'this'
  getTemplateData() {
    return {
      nextSaturday: this.nextSaturday,
      nextSunday: this.nextSunday,
      events: this.events,
      days: this.days,
      toDisplay: this.config.daysToDisplay,
      today: new Date().toLocaleDateString(),
      showAddress: this.config.showAddress
    };
  }
});

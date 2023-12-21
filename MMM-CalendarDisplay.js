Module.register("MMM-CalendarDisplay", {
  defaults: {
    calendars: []
  },
  start() {
    console.log("STARTED CALENDAR THINGY");

    this.sendSocketNotification("GET_EVENTS", this.config.calendars);

    console.log("Sent socket");
  }
});

Module.register("MMM-CalendarDisplay", {
  defaults: {
    calendars: [],
    daysToFetch: 7,
    refreshTime: 600000
  },

  __getWeekendDates() {
    const today = new Date();
    let currentDay = today.getDay();
    const daysToAdd = currentDay === 6 ? 0 : 6 - currentDay;

    const nextSaturday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + daysToAdd
    );
    const nextSunday = new Date(
      nextSaturday.getFullYear(),
      nextSaturday.getMonth(),
      nextSaturday.getDate() + 1
    );

    return [nextSaturday.toDateString(), nextSunday.toDateString()];
  },

  start() {
    this.sendSocketNotification("GET_EVENTS", {
      calendars: this.config.calendars,
      daysToFetch: this.config.daysToFetch
    });

    this.nunjucksEnvironment().addFilter("getEventsForDay", (day) => {
      return this.events[day];
    });

    setInterval(() => {
      this.sendSocketNotification("GET_EVENTS", {
        calendars: this.config.calendars,
        daysToFetch: this.config.daysToFetch
      });
    }, this.config.refreshTime);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "EVENTS") {
      let [saturday, sunday] = this.__getWeekendDates();
      this.events = payload.returnObj;
      this.days = payload.days;

      this.today = new Date().toDateString();
      this.saturday = saturday;
      this.sunday = sunday;

      this.updateDom(300);
    }
  },

  getTemplate() {
    return "CalendarDisplay.njk";
  },

  getStyles() {
    return ["CalendarDisplay.css"];
  },

  getTemplateData() {
    return {
      events: this.events,
      days: this.days,
      today: this.today,
      saturday: this.saturday,
      sunday: this.sunday
    };
  }
});

Module.register("MMM-CalendarDisplay", {
  defaults: {
    calendars: [],
    daysToDisplay: 7,
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
  __getFirstWeekOfNextMonth() {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const firstWeek = [];
    const firstDayMonth = nextMonth.getDay();

    const daysInFirstWeek = 7 - (firstDayMonth === 0 ? 7 : firstDayMonth) + 1;

    for (let i = 0; i < daysInFirstWeek; i++) {
      const nextDate = new Date(nextMonth);
      nextDate.setDate(nextMonth.getDate() + i);
      firstWeek.push(nextDate.toDateString());
    }

    return firstWeek;
  },

  start() {
    this.sendSocketNotification("GET_EVENTS", {
      calendars: this.config.calendars,
      daysToDisplay: this.config.daysToDisplay
    });

    this.nunjucksEnvironment().addFilter("getEventsForDay", (day) => {
      return this.events[day];
    });

    setInterval(() => {
      this.sendSocketNotification("GET_EVENTS", {
        calendars: this.config.calendars,
        daysToDisplay: this.config.daysToDisplay
      });
    }, this.config.refreshTime);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "EVENTS") {
      let [saturday, sunday] = this.__getWeekendDates();
      this.events = payload.toDisplay.events;
      this.days = payload.toDisplay.days;

      this.today = new Date().toDateString();
      this.saturday = saturday;
      this.sunday = sunday;

      let calDisplayData = [];

      Object.keys(payload.monthOnly.events).forEach((day) => {
        calDisplayData.push({
          day,
          events: payload.monthOnly.events[day].length
        });
      });

      this.__getFirstWeekOfNextMonth().forEach((day) => {
        calDisplayData.push({
          day,
          events: 0,
          nextMonth: true
        });
      });

      console.log(calDisplayData);

      this.sendNotification("CAL-DISPLAY-EVENTS", {
        data: calDisplayData,
        today: this.today
      });

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
      sunday: this.sunday,
      toDisplay: this.config.daysToDisplay
    };
  }
});

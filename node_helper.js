const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");

module.exports = NodeHelper.create({
  __getDatesBetween(startDate, endDate) {
    const datesArray = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return datesArray;
  },

  __getWeekDates() {
    const currentDate = new Date();
    const daysToMonday = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - daysToMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return [startDate, endDate];
  },

  async __GetWeeksEvents(calendars) {
    const get = bent("string");

    const responses = await Promise.all(calendars.map((url) => get(url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

    const currentDate = new Date();
    const daysUntilMonday = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - daysUntilMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const events = Object.keys(iCalData[0]);
    const filteredEvents = events
      .map((event) => iCalData[0][event])
      .filter(
        (eventData) =>
          eventData.type === "VEVENT" &&
          eventData.start >= startDate &&
          eventData.end <= endDate
      )
      .map((eventData) => ({
        name: eventData.summary,
        dateStart: {
          date: eventData.start.toDateString(),
          time: eventData.start.toTimeString(),
          epoch: eventData.start.getTime()
        },
        dateEnd: {
          date: new Date(
            eventData.end.setDate(eventData.end.getDate() - 1)
          ).toDateString(),
          time: eventData.end.toTimeString(),
          epoch: eventData.end.getTime()
        },
        location: eventData.location
      }));

    return filteredEvents;
  },

  async FormatEvents(calendars) {
    const events = await this.__GetWeeksEvents(calendars);

    let [weekStart, weekEnd] = this.__getWeekDates();
    let days = this.__getDatesBetween(weekStart, weekEnd).map((date) => {
      let [weekday, day] = date
        .toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
        .split(" ");

      return {
        weekday,
        day,
        full: new Date(date.setHours(0, 0, 0, 0)).toDateString()
      };
    });

    let returnObj = {};

    days.forEach((day) => {
      returnObj[day.full] = [];
    });

    events.forEach((event) => {
      let fullDays = days.map((day) => day.full);

      if (fullDays.includes(event.dateStart.date)) {
        if (event.dateEnd.epoch > event.dateStart.epoch) {
          console.log(
            `Event '${event.name}' is multi-day | Start date: ${event.dateStart.date} End date: ${event.dateEnd.date}`
          );

          let between = this.__getDatesBetween(
            new Date(event.dateStart.date),
            new Date(event.dateEnd.date)
          ).map((date) => date.toDateString());

          between.forEach((date) => {
            if (returnObj[date]) {
              returnObj[date].push(event);
            }
          });
        } else {
          console.log(
            `Event '${event.name}' is single day | Start date: ${event.dateStart.date}`
          );

          if (returnObj[event.dateStart.date]) {
            returnObj[event.dateStart.date].push(event);
          }
        }
      }
    });

    return { returnObj, days };
  },

  async socketNotificationReceived(notification, urls) {
    if (notification === "GET_EVENTS") {
      let { returnObj, days } = await this.FormatEvents(urls);
      console.log(returnObj, days);

      this.sendSocketNotification("EVENTS", { returnObj, days });
    }
  }
});

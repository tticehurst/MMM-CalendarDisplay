const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");
const { rrulestr } = require("rrule");
// const rruleCache = {};

function __FormatDate24HourTime(epochTimestamp) {
  return new Date(epochTimestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

module.exports = NodeHelper.create({
  __GetDatesBetween(startDate, endDate) {
    const datesArray = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return datesArray;
  },

  __GetWeekDates(daysToDisplay) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (daysToDisplay - 1));

    endDate.setHours(23, 59, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    return [startDate, endDate];
  },

  __GetFullMonthDates() {
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 0, 0);

    return [startDate, endDate];
  },

  __MapEventData(eventData) {
    const adjustedEndDate = new Date(eventData.end);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

    const startTime = __FormatDate24HourTime(eventData.start.getTime());
    const endTime = __FormatDate24HourTime(eventData.end.getTime());

    const dateEnd = {
      date: 0,
      time: endTime,
      epoch: 0
    };

    if (eventData.start.toDateString() === eventData.end.toDateString()) {
      dateEnd.date = eventData.end.toDateString();
      dateEnd.epoch = eventData.end.getTime();
    } else {
      dateEnd.date = adjustedEndDate.toDateString();
      dateEnd.epoch = adjustedEndDate.getTime();
    }

    return {
      name: eventData.summary,
      dateStart: {
        date: eventData.start.toDateString(),
        time: startTime,
        epoch: eventData.start.getTime()
      },
      dateEnd,
      location: eventData.location,
      styles: eventData.styles
    };
  },

  async __GetWeeksEvents(calendars, startDate, endDate) {
    const get = bent("string");
    const allFilteredEvents = [];

    const responses = await Promise.all(calendars.map((c) => get(c.url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

    const styles = calendars.map((c) => c.styles);

    iCalData.forEach((data, index) => {
      data["styles"] = styles[index] || "";
    });

    for (const data of iCalData) {
      const events = Object.keys(data)
        .map((event) => data[event])
        .map((eventData) => {
          return { ...eventData, styles: data.styles };
        })
        .filter((eventData) => eventData.type === "VEVENT");

      const recurringEvents = events
        .filter((eventData) => eventData.rrule)
        .flatMap((eventData) => {
          let rruleString = eventData.rrule.toString();
          let match = Array.from(rruleString.matchAll(/;(.*):/g), (m) => m[0]);

          if (match.length > 0) rruleString = rruleString.replace(match, ":");

          const rrule = rrulestr(rruleString);

          const dates =
            // rruleCache[rrule] ||
            rrule.between(startDate, endDate, false, (date) => {
              return date >= startDate && date <= endDate;
            });

          // if (!rruleCache[rrule]) rruleCache[rrule] = dates;

          if (dates.length === 0) return null;

          return dates.map((date) => {
            return this.__MapEventData({ ...eventData, start: date });
          });
        })
        .filter(Boolean);

      const filteredEvents = events
        .filter(
          (eventData) =>
            eventData.end >= startDate && eventData.start <= endDate
        )
        .map(this.__MapEventData)
        .filter((filteredEvent) => {
          return !recurringEvents.some((recurringEvent) => {
            return (
              filteredEvent.name === recurringEvent.name &&
              filteredEvent.dateStart.date === recurringEvent.dateStart.date &&
              filteredEvent.dateEnd.date === recurringEvent.dateEnd.date
            );
          });
        });

      allFilteredEvents.push(...filteredEvents, ...recurringEvents);
      // console.log(recurringEvents);
    }

    // console.log("All events fetched");
    // allFilteredEvents.sort(
    //   (a, b) => a.name.charCodeAt(0) - b.name.charCodeAt(0)
    // );
    return allFilteredEvents.filter((e) => {
      return (
        e.name !== undefined &&
        e.dateStart !== undefined &&
        e.dateEnd !== undefined
      );
    });
  },

  async FormatEvents(calendars, startDate, endDate) {
    const events = await this.__GetWeeksEvents(calendars, startDate, endDate);

    let days = this.__GetDatesBetween(startDate, endDate).map((date) => {
      let [weekday, month, day] = date
        .toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short"
        })
        .replace(",", "")
        .split(" ");

      return {
        weekday,
        day,
        month,
        full: new Date(date.setHours(0, 0, 0, 0)).toDateString()
      };
    });

    let foundEvents = {};

    days.forEach((day) => {
      foundEvents[day.full] = [];
    });

    events.forEach((event) => {
      let fullDays = days.map((day) => day.full);

      if (
        fullDays.includes(event.dateStart.date) ||
        fullDays.includes(event.dateEnd.date)
      ) {
        if (event.dateEnd.epoch > event.dateStart.epoch) {
          let between = this.__GetDatesBetween(
            new Date(event.dateStart.date),
            new Date(event.dateEnd.date)
          ).map((date) => date.toDateString());

          between.forEach((date) => {
            if (foundEvents[date]) {
              foundEvents[date].push(event);
            }
          });
        } else {
          if (foundEvents[event.dateStart.date]) {
            foundEvents[event.dateStart.date].push(event);
          }
        }
      }
    });

    return { foundEvents, days };
  },

  async socketNotificationReceived(notification, config) {
    if (notification === "GET_EVENTS") {
      if (config.daysToDisplay === 0) return;

      let now = new Date();
      let maxDays = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

      if (config.daysToDisplay > maxDays) config.daysToDisplay = maxDays;

      let [toDisplayStartDate, toDisplayEndDate] = this.__GetWeekDates(
        config.daysToDisplay
      );

      let [monthStartDate, monthEndDate] = this.__GetFullMonthDates();

      let { foundEvents: weekEvents, days: weekDays } = await this.FormatEvents(
        config.calendars,
        toDisplayStartDate,
        toDisplayEndDate
      );

      let { foundEvents: monthEvents, days: monthDays } =
        await this.FormatEvents(config.calendars, monthStartDate, monthEndDate);

      this.sendSocketNotification("EVENTS", {
        toDisplay: { events: weekEvents, days: weekDays },
        monthOnly: { events: monthEvents, days: monthDays }
      });
    }
  }
});

# Magic mirror calendar module

### Config options:

| Option      | Description                                                 | Values                 |
| ----------- | ----------------------------------------------------------- | ---------------------- |
| daysToFetch | Changes the number of events to fetch and therefore display | `int` (example: 7)     |
| showAddress | Show addresses of calendar events with this field set       | `bool` (example: true) |
| calendars   | An array of objects with ical calendar links                | N/A                    |

### How to set up calendars

In your config you should have a field like:

```js

calendars: [
  {
    url: `ical url here`
    styles: `optional styles`
  }
]

```

Optional styles are:

- `bg-green`
- `bg-pink`
- `bg-black`
- `bg-red`
- `bg-black`
- `bg-darkblue`
- `text-gold`

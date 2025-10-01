## Configuration

```json
{
  "base": "https://api.example.com/v1",
  "routes": {
    "orders.index": "orders/index",
    "orders.show": "orders/show/{order}",
    "orders.create": "orders/create",
    "orders.items.delete": "orders/{order}/items/{item}"
  }
}
```

```ts
import axios from "axios";
import {provideApiConfig} from "./Api";

const config = await axios.get('/config.json');
provideApiConfig(config);
```

## Usage

GET:

```ts
import {useApi} from "./Api";

// with route configuration
const orders = await useApi().url('orders.index', {
    sort: 'createdAt',
    fromDate: "2025-01-01",
}).get();

const order = await useApi().url('orders.show', {order: id}).get();

// without route configuration
const user = await useApi().get('https://example.com/v1/user/123');
```

POST:

```ts
import {useApi} from "./Api";

useApi().url('orders.create').body({
    id: id,
    userId: userId
}).post();
```

DELETE:

```ts
import {useApi} from "./Api";

useApi().url('orders.items.delete', {
    order: orderId,
    item: orderItem,
}).delete();
```

Cached requests:  
available storages: 'session', 'local', 'memory'  
default: 'memory'

```ts
import {useApi} from "./Api";

const orders = useApi()
    .cache(3600, 'session')
    .url('orders.index')
    .get();
```

## Roadmap

1. Improve the authorization mechanism (currently a draft version)
2. Extend route configuration options
3. Enhance error handling and reporting for API requests
4. Add caching support for frequently requested data (route configuration options)
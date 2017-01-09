# sample-gateway

Sample api gateway.

## Running the container

```
$ docker run -d --name gateway --link test-authdb:mysql --link some-rabbit:my-rabbit -p 8080:8080 <user name>/gateway
```

## Running the RabbitMQ broker

```
$ docker run -d --hostname my-rabbit --name some-rabbit rabbitmq:3
```

# sample-gateway

Sample api gateway.

## Running the container

```
$ docker run -d --name gateway --link auth-db:mysql --link broker:my-rabbit -p 8080:8080 <user name>/gateway
```

## Running dependencies

See [this documentation](https://github.com/darrensiegel/sample-auth-service/README.md)

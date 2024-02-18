# GoInvoke

GoInvoke is a simplified UI for use with InvokeAI. This project is not
affiliated with InvokeAI in any way.

A live demo can be found at
[https://go-invoke.bluegrassbits.com](https://go-invoke.bluegrassbits.com).
You can use this instance if you have an `InvokeAI` instances running and
configured with SSL. Just plug in `https://<my-invoke-ai-endpoint>` in the
`Server > Address` form field. An optional basic-auth integration has been
implemented but still needs some work.

## Getting started

If you have a local running instance of `InvokeAI`, you can get started by simply
serving the contents of `web/` on a local webserver.

```bash
$ git clone https://github.com/bluegrassbits/go-invoke.git
$ cd web/
$ python -m http.server -b 0.0.0.0 9999
Serving HTTP on 0.0.0.0 port 9999 (http://0.0.0.0:9999/) ...
```

You'll need to make sure that `http://localhost:9999` is added to the
`allowed_origins` list for `InvokeAI`. Refer to InvokeAI's docs for
configuration info.

## Risky and not well tested

Included in this repo is an `install.sh` script that will attempt to this project
into the invokeai install's web asset dir. The benefit of this is there is no
need to mess with allowed_origins and it should negate any cors errors.

```bash
$ git clone https://github.com/bluegrassbits/go-invoke.git
$ cd go-invoke
$ INVOKE_DIR=/data/InvokeAI sh install.sh
```
If everything goes well, `GoInvoke` will be available at `http://<your-invoke-instance>/go`

#!/bin/bash
set -e

INVOKE_DIR=${1:-$(pwd)}
DIST_PATH=$(echo $INVOKE_DIR/.venv/lib/python*/site-packages/invokeai/frontend/web/dist)
WEB_DIR=./web
GO_DIR=$DIST_PATH/go

if [ ! -d $DIST_PATH ]; then
    echo "Dist directory not found. Please install 'invokeai' first"
    exit 1
fi

mkdir -p $GO_DIR
echo "Copying web contents to:"
echo "$DIST_PATH"
echo ""

cp -r $WEB_DIR/index.html $GO_DIR/
cp -r $WEB_DIR/css $GO_DIR/
cp -r $WEB_DIR/js $GO_DIR/
cp -r $WEB_DIR/img $GO_DIR/

echo "Web contents installed to:"
echo "$GO_DIR"
echo ""
echo "GoInvoke is ready at http://<instance-ip>:<port>/go"

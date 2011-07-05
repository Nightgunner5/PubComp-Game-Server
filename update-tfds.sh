#!/bin/bash
if [[ ! -s steam ]]
then
	wget http://storefront.steampowered.com/download/hldsupdatetool.bin
	chmod +x hldsupdatetool.bin
	echo yes | ./hldsupdatetool.bin
	rm hldsupdatetool.bin
fi

# Verify that we have the latest version of hldsupdatetool
./steam -command update

# Check, update, or install the latest TF2
./steam -command update -dir tfds -game tf -retry

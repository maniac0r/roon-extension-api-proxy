# stop and remove existing docker container first
sudo docker stop roon-extension-api-proxy
sudo docker rm roon-extension-api-proxy

# create docker container based on node base image
sudo docker run -d --name roon-extension-api-proxy --restart on-failure --network host -v "$PWD":/usr/src/app -w /usr/src/app node bash ./run_extension.sh
## Controlling Roon with restfull (json) interface

Heaviliy inspired on the existing http player and websocket projects for Roon (thanks for that!).
This NodeJS service is needed as a proxy between my Python projects (HomeAssistant module, Kodi addon) that want to communicate with the Roon API while I'm still working out how to directly connect by reverse engineering the Javascript SDK. Final goal is that those python projects connect to the Roon websockets API directly without this intermediate proxy. For the sake of getting some results quickly this is now the workaround.


## Installation

1. Install Node.js from https://nodejs.org.

   * On Windows, install from the above link.
   * On Mac OS, you can use [homebrew](http://brew.sh) to install Node.js.
   * On Linux, you can use your distribution's package manager, but make sure it installs a recent Node.js. Otherwise just install from the above link.

   a) You may also use Docker to host the extension, for that case I've included a simple script which you can run to install/update the docker container with the nodeJS module running.

2. Download/install the extension

   * Download the entire contents of this Github repo into a local folder. 

   TIP: Click the green 'Clone or Download' button and select 'Download ZIP'.

   * Extract the zip file in a local folder.

   * Install the dependencies and run it:
    ```
    npm install
    node .
    ```

    * Linux/MacOS users, you can simple run the run_extension.sh
    ```bash
    node .
    ```

   * To run the extension as a docker container (e.g. on your NAS or server)
    Simply Run the install_docker.sh file on your Docker host.


3. Done !

    The extension should appear in Roon now. See Settings->Setup->Extensions and you should see it in the list. You will have to allow it once to communicate with Roon. 


## Important notes

This proxy runs a webserver at a given port (defaults to 3006). On this webservice some rest endpoints ar emade available for the Python modules to talk to Roon. This is unprotected / unsafe communication. Never ever open up this port to the outside world, keep it internal in your network. If you fail to do so, hackers will be able to control your Roon zones (spooky !).


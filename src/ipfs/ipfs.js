const IPFS = require("ipfs");
const { globSource } = IPFS;
const fs = require("fs");
const util = require("util");
const BufferList = require("bl/BufferList");
const { log } = require("console");
const { object } = require("ipfs/src/core/components");
const writeFile = util.promisify(fs.writeFile);

//options specific to globSource
const globSourceOptions = {
  recursive: false,
};

//example options to pass to IPFS
const addOptions = {
  pin: true,
  wrapWithDirectory: false,
  timeout: 10000,
};

const addFile = async (ipfs, fileName, create, data) => {
  const fileCID = [];
  if (create) {
    writeFile(`./encrypted-files/${fileName}_encrypted`, data)
      .then(async () => {
        console.log("adding file to ipfs...");
        for await (const file of ipfs.addAll(
          globSource(`./json-data/${fileName}`, globSourceOptions),
          addOptions
        )) {
          fileCID.push(file);
        }
        return fileCID[0].cid;
      })
      .catch((err) => {
        reject(err);
        console.log("Error during uploading the file to ipfs", err);
      });
  } 
  else {
    console.log("adding file to ipfs...");
    console.log(Object.keys(ipfs));
    for await (const file of ipfs.addAll(
      globSource(`./encrypted-files/${fileName}_encrypted`, globSourceOptions),
      addOptions
    )) {
      fileCID.push(file);
    }
    console.log(flieCID[0].cid);
    return fileCID[0].cid;
  }
};

const retriveFile = async (ipfs, cid, fileName) => {
  for await (const file of ipfs.get(cid)) {
    console.log(file.path);

    if (!file.content) continue;

    const content = new BufferList();
    for await (const chunk of file.content) {
      content.append(chunk);
    }
    fs.writeFile(fileName, content.toString(), (res) => {
      console.log(res);
    });
  }
};

module.exports = {
  addFile,
  retriveFile,
};

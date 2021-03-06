const express = require("express");
const axios = require("axios");
const PatientDetails = require("../../schemas/patient-details-model");
const { MedicalDetials } = require("../../schemas/medical-details-model");
const { PatientModel } = require("../../schemas/transaction-model");
const fs = require("fs");
const crypto = require("crypto");
const { MerkleTree } = require("merkletreejs");
const SHA256 = require("crypto-js/sha256");
const e = require("express");

const getPatientRoute = (blockchain, merkleTree) => {
  const router = express.Router();
  let patientDetails;
  let medicalDetails;
  let patientUUID;
  let remove;

  router.post("/", async (req, res) => {
    // Login credentials verify
    console.log(req.body.uid, req.body.random_nos, req.body.digital_signature);
    const isValidSignature = await axios.post(
      "http://127.0.0.1:8085/verify-sign",
      {
        uid: req.body.uid,
        text_data: req.body.random_nos,
        signature: req.body.digital_signature,
      }
    );

    if (!isValidSignature.data.status) {
      res.redirect(`/signature-check&valid=${false}`);
    }

    console.log("signature validity -> ", isValidSignature);

    // Getting Patient Details
    await PatientDetails.findOne(
      { uuid: req.body.uid },
      async (err, patient) => {
        if (err) {
          console.log("Error during retriving patient data from DB", err);
          return;
        }
        if (patient == null) {
          console.log("no data found !!");
          res.render("login/patient", {
            loginError: "Please enter a valid credential..",
          });
          return;
        }
        patientDetails = patient;
        patientUUID = patient.uuid;

        // Getting Medical Details
        await MedicalDetials.findOne({ _id: req.body.uid })
          .lean()
          .exec((err, details) => {
            if (err) {
              console.log("Error during retriving medical data from DB", err);
              return;
            }
            if (details == null) {
              res.render("dashboard-patient/dashboard", {
                patientName: patientDetails.name,
                patientUID: patientDetails.uuid,
              });
              return;
            }

            medicalDetails = details;
            console.log(medicalDetails);
            if (isValidSignature.data.status) {
              res.render("dashboard-patient/dashboard", {
                patientName: patientDetails.name,
                patientUID: patientDetails.uuid,
              });
            } else {
              res.render("login/patient", {
                loginError: "Please enter a valid credential..",
              });
            }
          });
      }
    );
  });

  router.get("/", (req, res) => {
    res.render("dashboard-patient/dashboard", {
      patientName,
      patientUID,
    });
  });

  router.get("/about", (req, res) => {
    res.render("dashboard-patient/about", {
      patientUUID: patientDetails.uuid,
      patientName: patientDetails.name,
      patientAge: 2020 - new Date(patientDetails.dob).getFullYear(),
      patientGender: patientDetails.gender,
      patientAddress: patientDetails.address,
      patientPnum: patientDetails.pnum,
    });
  });

  router.get("/prescription", (req, res) => {
    const medicalData =
      medicalDetails === undefined ? " " : medicalDetails.furtherDetails;
    res.render("dashboard-patient/prescription", {
      medicalDetails: medicalData,
    });
  });

  router.get("/appoinment", (req, res) => {
    res.render("dashboard-patient/appoinment");
  });

  router.get("/hospital", (req, res) => {
    const medicalData =
      medicalDetails === undefined ? " " : medicalDetails.furtherDetails;
    res.render("dashboard-patient/hospital", {
      medicalDetails: medicalData,
    });
  });

  router.get("/clinic", (req, res) => {
    res.render("dashboard-patient/clinic");
  });

  router.get("/pharmacy", (req, res) => {
    res.render("dashboard-patient/pharmacy");
  });

  router.get("/laboratory", (req, res) => {
    res.render("dashboard-patient/laboratory");
  });

  router.get("/diabetes-report", (req, res) => {
    const medicalData =
      medicalDetails === undefined ? " " : medicalDetails.furtherDetails;
    res.render("dashboard-patient/diabetes", {
      medicalDetails: medicalData,
    });
  });

  router.get("/bp-report", (req, res) => {
    const medicalData =
      medicalDetails === undefined ? " " : medicalDetails.furtherDetails;
    res.render("dashboard-patient/bp", {
      medicalDetails: medicalData,
    });
  });

  router.get("/share-data", (req, res) => {
    console.log("share ->", patientUUID);
    res.render("dashboard-patient/share-data", {
      patientUUID,
    });
  });

  router.post("/patient", async (req, res) => {

    if (req.body.exist == "add") {
      remove = 0;
    } else {
      remove = 1;
    }

    const typeOfPolicy = req.body.policy;

    const time = req.body.time;
    console.log(time);
    let myDate = time.split("-");
    myDate = myDate[1] + "/" + myDate[2] + "/" + myDate[0];
    console.log(new Date(myDate).getTime());

    if (typeOfPolicy == "multifile") {
      let transactionsDetails = null;
      PatientModel.findOne({ uuid: patientUUID })
        .exec()
        .then((data) => {
          if (!data) {
            console.log("patient not found");
            return;
          }
          let result = [];
          transactionsDetails = data.transactions;
          console.log(transactionsDetails);
          for (
            let transaction = 0;
            transaction < transactionsDetails.length;
            transaction++
          ) {
            console.log(
              "db time -> ",
              transactionsDetails[transaction].time,
              new Date(myDate).getTime()
            );
            console.log(
              transactionsDetails[transaction].time > new Date(myDate).getTime()
            );
            if (
              transactionsDetails[transaction].time > new Date(myDate).getTime()
            ) {
              result.push(transactionsDetails[transaction].ipfsFileHash);
            }
          }
          console.log("transacion model ->", result);

          const leaves = result.map((x) => SHA256(x));
          const tree = new MerkleTree(leaves, SHA256);
          MerkleTree.print(tree);
          const root = tree.getRoot().toString("hex");
          merkleTree.addTree(patientUUID, req.body.duid, tree, root)

          axios
            .post("http://127.0.0.1:8099/newPolicy", {
              s_uid: patientUUID,
              r_uid: req.body.duid,
              data_hash: root,
              public_key_digitalsign: crypto
                .createHash("sha256")
                .update(root)
                .digest("hex"),
              capsule: " ",
              remove,
            })
            .then((res) => {
              console.log(res);
              if (res.data.status == "success" && remove == 0) {
                console.log("sending new policy tranaction");
                blockchain.newPolicyTransaction({
                  senderUID: patientUUID,
                  receiverUID: req.body.duid,
                  dataHash: root,
                  capsule: "multi file policy transaction",
                  remove: false,
                });
              } else if (remove == 1) {
                console.log("revoking the policy");
                const chainLength = blockchain.newPolicyRemoveTransaction({
                  senderUID: patientUUID,
                  receiverUID: req.body.duid,
                  dataHash: root,
                });
                console.log(chainLength);
              }
            })
            .catch((err) => {
              console.log("Error during creating new policy", err);
            });
        });
    } 
    
    
    else {
      console.log("chain -> ", blockchain.chain[1].transactions);
      let capsule = null;
      for (const block of blockchain.chain) {
        for (const transaction of block.transactions) {
          if (transaction.ipfsFileHash == req.body.ipfsHash) {
            capsule = transaction.capsule;
            break;
          }
        }
      }

      console.log("capsule -> ", capsule);
      if (capsule) {
        axios
          .post("http://127.0.0.1:8099/newPolicy", {
            s_uid: patientUUID,
            r_uid: req.body.duid,
            data_hash: req.body.ipfsHash,
            public_key_digitalsign: crypto
              .createHash("sha256")
              .update(capsule)
              .digest("hex"),
            capsule,
            remove,
          })
          .then((res) => {
            console.log(res);
            if (res.data.status == "success" && remove == 0) {
              console.log("sending new policy tranaction");
              blockchain.newPolicyTransaction({
                senderUID: patientUUID,
                receiverUID: req.body.duid,
                dataHash: req.body.ipfsHash,
                capsule,
                remove: false,
              });
            } else if (remove == 1) {
              console.log("revoking the policy");
              const chainLength = blockchain.newPolicyRemoveTransaction({
                senderUID: patientUUID,
                receiverUID: req.body.duid,
                dataHash: req.body.ipfsHash,
              });
              console.log(chainLength);
            }
          })
          .catch((err) => {
            console.log("Error during creating new policy", err);
          });
      }
    }

    res.render("dashboard-patient/dashboard", {
      patientName: patientDetails.name,
      patientUID: patientDetails.uuid,
    });

  });

  return router;
};

module.exports = {
  getPatientRoute,
  remove
}

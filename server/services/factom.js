import IdentityModel from "../models/Demo_db/IdentityModel";
import Errors from "../classes/Errors";
import Database from "../classes/Database_Demo_db";
import Properties from "../properties";
import EntryModel from "../models/Demo_db/EntryModel";
import { loggers } from "winston";

/**
 * This method will be executed, everytime a record is generated in the Model who have
 * create identity for each record selected.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @return {String} identityId
 */
const createIdentity = async () => {
  const id = await IdentityModel.create();
  return id;
};

/**
 *
 * @param {String} currentModelName, name of the model
 * @param {Object} bodyRequest, object data who will be factomized into the blockchain
 * @param {String} httpMethod, name of the http method, POST / PUT / PATCH / DELETE
 * @param {String} factomizeNameFK, name of the FK who is relationated with the identity model
 * @param {String*} currentModelId, id of the current model, required for PUT / PATCH / DELETE
 */
const factomize = async (
  currentModelName,
  bodyRequest,
  httpMethod,
  factomizeNameFK,
  currentModelId = null
) => {
  try {
    const model = Properties.factom.model[currentModelName];
    const httpUpper = httpMethod.toUpperCase();

    let modelFactomizeFKId = "";
    if (httpUpper === "POST") {
      modelFactomizeFKId = bodyRequest[factomizeNameFK];
    } else {
      modelFactomizeFKId = await getRelationIdentityId(
        currentModelId,
        currentModelName,
        factomizeNameFK
      );
    }

    if (
      !(
        httpUpper === "POST" ||
        httpUpper === "PUT" ||
        httpUpper === "PATCH" ||
        httpUpper === "DELETE"
      )
    )
      throw new Errors.INVALID_HTTP_METHOD();
    if (!model) throw new Errors.INVALID_MODEL();
    // if the current model doesn't have an identity related, you can't factomize
    if (!modelFactomizeFKId) throw new Errors.IDENTITY_MODEL_FK_NOT_VALID();

    const factomizedModel = model.factomized;

    if (httpUpper === "PUT") {
      if (!currentModelId) throw new Errors.INVALID_CURRENT_MODEL_ID();
      if (!factomizeNameFK) throw new Errors.INVALID_IDENTITY_MODEL_FK();

      const currentModelResult = await Database.getConnection().models[
        currentModelName
      ].findByPk(currentModelId);

      // We validate if the fk name is wrong
      if (!(factomizeNameFK in currentModelResult.dataValues))
        throw new Errors.INVALID_IDENTITY_MODEL_FK();

      const previousIdFK = currentModelResult.dataValues[factomizeNameFK];

      if (factomizeNameFK in bodyRequest) {
        const currentIdFK = bodyRequest[factomizeNameFK];
        if (previousIdFK != currentIdFK) {
          createEntry(currentIdFK, bodyRequest, factomizedModel, httpUpper);
        } else {
          createEntry(previousIdFK, bodyRequest, factomizedModel, httpUpper);
        }
      } else {
        createEntry(previousIdFK, bodyRequest, factomizedModel, httpUpper);
      }
    } else if (httpUpper === "POST") {
      createEntry(
        bodyRequest[factomizeNameFK],
        bodyRequest,
        factomizedModel,
        httpUpper
      );
    } else if (httpUpper === "DELETE") {
      createEntry(
        modelFactomizeFKId,
        { id: currentModelId },
        factomizedModel,
        httpUpper
      );
    }
  } catch (e) {
    throw e;
  }
};

const getRelationIdentityId = async (
  currentModelId,
  currentModelName,
  factomizeNameFK
) => {
  try {
    loggers.info(currentModelId);
    const modelResult = await Database.getConnection().models[
      currentModelName
    ].findOne({
      where: { _id: currentModelId }
    });
    return modelResult.dataValues[factomizeNameFK];
  } catch (error) {
    throw new Errors.INVALID_MODEL();
  }
};

/*
    Util function
    Convert the JSON data into a Nomenclature for the Entry Content.
*/
const convertEntryContent = (record, action) => {
  return {
    record,
    action
  };
};

/*
    Util function
    First we get the Doctor information related to the foreign key of the Patient
    then, we get The Identity and the Audit Chain related to this identity
    finally, we create an entry into this Audit Chain.
*/
const createEntry = async (
  modelFactomizeFKId,
  bodyRequest,
  factomizedModel,
  httpMethod
) => {
  try {
    // Get The Model Relation identity related to the current Model
    const factomizedModelResult = await Database.getConnection().models[
      factomizedModel
    ].findByPk(modelFactomizeFKId);

    // If the identity column is renamed, this should be changed
    const { identity } = factomizedModelResult.dataValues;

    // Search the Identity data
    const identityResult = await Database.getConnection().models.Identity.findOne(
      {
        where: {
          _id: identity
        }
      }
    );

    // Search the Audit Chain related to this identity
    const auditChain = await Database.getConnection().models.Chain.findOne({
      where: {
        identity,
        content: "Audit Chain"
      }
    });

    // Extract the data and used it to create the Entry
    const { _id, chain_id } = auditChain.dataValues;
    const { key_pairs } = identityResult.dataValues;
    const signerChainId = identityResult.dataValues.chain_id;

    // We create the entry content
    let currentModelData = convertEntryContent(bodyRequest, httpMethod);

    EntryModel.create(
      chain_id,
      key_pairs[0].private_key,
      signerChainId,
      currentModelData,
      _id
    );
  } catch (e) {
    console.log(e);
  }
};

export { createIdentity, factomize, getRelationIdentityId };

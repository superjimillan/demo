// Import Sequelize
import Sequelize from "sequelize";
import InitSchema from "../models/schema_demo_db";
import UserModel from "../models/Demo_db/UserModel";

// Logging
import Logger from "./Logger";
// Properties
import properties from "../properties.js";

class Database {
  constructor() {}

  /**
   * Init database
   */
  async init() {
    await this.authenticate();
    Logger.info(
      "Database connected at: " +
        properties.demo_db.host +
        ":" +
        properties.demo_db.port +
        "//" +
        properties.demo_db.user +
        "@" +
        properties.demo_db.name
    );

    // Import schema
    InitSchema();

    await UserModel.createAdminUser();

  }

  /**
   * Start database connection
   */
  async authenticate() {
    Logger.info("Authenticating to the databases...");

    const sequelize = new Sequelize(
      properties.demo_db.name,
      properties.demo_db.user,
      properties.demo_db.password,
      {
        host: properties.demo_db.host,
        dialect: properties.demo_db.dialect,
        port: properties.demo_db.port,
        logging: false
      }
    );
    this.dbConnection_demo_db = sequelize;

    try {
      await sequelize.sync();
    } catch (err) {
      // Catch error here
      Logger.error(`Failed connection to the DB`);
      Logger.error(err);
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.authenticate();
    }
  }

  /**
   * Get connection db
   */
  getConnection() {
    return this.dbConnection_demo_db;
  }
}

export default new Database();

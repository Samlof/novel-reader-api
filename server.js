const axios = require("axios").default;
const cheerio = require("cheerio");

const admin = require("firebase-admin");

let serviceAccount = require("./firebase_secrets.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://novel-reader-250a9.firebaseio.com",
});

const siteUrl = "https://vipnovel.com/vipnovel/library-of-heavens-path/";

// Get a reference to the database service
let db = admin.firestore().collection("novels");

/**
 *
 * @param {string} name
 * @param {string} link
 */
function addToDb(name, link) {
  return db.add({
    name,
    link,
    dateNumber: new Date().getTime(),
  });
}

/** @typedef {object} Novel
 * @property {string} name
 * @property {string} link
 * @property {number} dateNumber
 */

/**
 * @returns {Promise<Novel[]>}
 */
async function getDbLinks() {
  const resPromises = await db.listDocuments();
  if (resPromises.length === 0) return [];
  const objects = await Promise.all(resPromises.map((x) => x.get()));
  return objects.filter((x) => !!x).map((x) => /**@type Novel */ (x.data()));
}

// Get cheerio data from siteUrl
const fetchData = async () => {
  const result = await axios.get(siteUrl);
  return cheerio.load(result.data);
};

async function getNewLinks() {
  const $ = await fetchData();
  /** @type {{link: string, name: string}[]} */
  const links = [];
  // Parse the 10 newest ones into links
  $(".wp-manga-chapter a[href]")
    .slice(0, 10)
    .each((_, x) => {
      const elem = $(x);
      links.push({ name: elem.text().trim(), link: elem.attr("href") });
    });
  return links;
}

async function updateDb() {
  const newLinks = await getNewLinks();
  const oldLinks = await getDbLinks();

  const diffLinks = newLinks.filter((x) =>
    oldLinks.every((y) => y.name !== x.name)
  );
  for (const link of diffLinks) {
    addToDb(link.name, link.link);
  }
}
updateDb();

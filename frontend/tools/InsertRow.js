/* @typedef {Object} InsertRowParams
 * @property {string} seniorName
 * @property {number} age
 * @property {string} gender
 * @property {string} location
 * @property {string} primaryCondition
 * @property {string} mobilityLevel
 * @property {string} cognitiveStatus
 * @property {string} careTypeNeeded
 * @property {number} hoursPerDay
 * @property {string} budgetRange
 * @property {string} preferredStartDate
 * @property {string} contactName
 * @property {string} contactPhone
 * @property {string} contactEmail
 * @property {string} [notes]
 */

// Then use JSDoc for your function
/**
 * @param {InsertRowParams} params
 * @returns {Promise<{success: boolean, error?: string}>}/* 🔐 Runtime config from env */

const insertRow = async (params) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/insert-row`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params }),
    });
    if (!response.ok)
      throw new Error("Some error occured while inserting a record");
    const data = response.json();
    return data;
  } catch (error) {
    console.log("Some error occured while routing query to backend");
  }
};

export default insertRow;

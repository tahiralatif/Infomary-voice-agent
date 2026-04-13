// Tool definitions sent to Speechmatics StartConversation
export const speechmaticsTools = [
  {
    type: "function",
    function: {
      name: "google_search",
      description: "Search Google for nearby senior care facilities, hospitals, or services based on user location and need.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_lead",
      description: "Save or update the senior care lead info progressively. Pass the session_id and all other collected fields.",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "The session ID for the current conversation." },
          name: { type: "string" }, email: { type: "string" },
          phone: { type: "string" }, care_need: { type: "string" },
          location: { type: "string" }, notes: { type: "string" },
          age: { type: "string" }, gender: { type: "string" },
          living_arrangement: { type: "string" }, physician: { type: "string" },
          conditions: { type: "string" }, hospitalizations: { type: "string" },
          medications: { type: "string" }, allergies: { type: "string" },
          care_type: { type: "string" }, care_hours: { type: "string" },
          insurance: { type: "string" }, budget: { type: "string" },
          home_hazards: { type: "string" }, medical_equipment: { type: "string" },
          other_factors: { type: "string" }, transportation: { type: "string" }
        },
        required: ["session_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "EndConversation",
      description: "End the conversation immediately when user says: bye, goodbye, shut up, stop, end, done, exit, quit, see you, farewell, take care, thanks bye, thank you bye."
    }
  }
]

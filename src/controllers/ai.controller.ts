import { Request, Response } from 'express';
import { env } from '../config/env';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { genAI } from '../config/gemini';

function getLocalTripPlan(destination: string, days: number, budget: string, interests: string[]): string {
  const dest = destination.toLowerCase();
  const interestStr = interests?.join(', ') || 'sightseeing, heritage';

  let overview = '';
  let dayByDay = '';
  let costs = '';
  let food = '';
  let tips = '';

  if (dest.includes('gaya') || dest.includes('bodh') || dest.includes('buddhist')) {
    overview = `Welcome to the **Buddhist Circuit Spiritual Itinerary**. This ${days}-day tour is meticulously customized for your interests in *${interestStr}* under a **${budget}** budget. You will trace the steps of Lord Buddha across Bodh Gaya, Rajgir, and Nalanda.`;

    dayByDay = `
### 📅 Day 1: Arrival & Spiritual Bodh Gaya
* **Morning (09:00 AM - 12:00 PM):** Arrive in Bodh Gaya. Check into your hotel and refresh. Visit the legendary **Mahabodhi Temple Complex** (UNESCO World Heritage Site) to experience the serene chants under the sacred **Bodhi Tree**.
* **Afternoon (01:30 PM - 04:30 PM):** Enjoy a traditional vegetarian lunch. Explore the Giant Buddha Statue (80 feet) and the beautiful Japanese and Thai Monasteries.
* **Evening (05:30 PM - 08:30 PM):** Attend evening meditation at the Mahabodhi Temple. Walk through the local Bodh Gaya handicraft market.

### 📅 Day 2: Ancient Valleys of Rajgir
* **Morning (07:30 AM - 11:30 AM):** Travel to Rajgir (approx. 2 hours drive). Ride the thrilling single-cable **Rajgir Ropeway** to the top of Ratnagiri Hill to visit the majestic white **Vishwa Shanti Stupa (Peace Pagoda)**.
* **Afternoon (12:00 PM - 03:00 PM):** Head to the sacred hot springs (**Brahmakund**) for a refreshing sulfur bath. Enjoy local delicacies like Silao Khaja for dessert.
* **Evening (03:30 PM - 07:00 PM):** Visit **Ghora Katora Lake**, an eco-friendly lake surrounded by hills, reachable by horse carriage. Take a quiet boat ride.

### 📅 Day 3: Intellectual Nalanda & Return
* **Morning (08:30 AM - 12:00 PM):** Travel to the ruins of **Nalanda University** (ancient international seat of learning). Explore the massive brick stupas, monasteries, and the Nalanda Archaeological Museum.
* **Afternoon (01:00 PM - 03:00 PM):** Visit the Xuanzang (Hieun Tsang) Memorial Hall to learn about the famous Chinese traveler. Have lunch nearby.
* **Evening (03:30 PM onwards):** Drive back to Patna or Gaya for your onward departure.
        `;

    costs = `
### 💰 Estimated Cost Breakdown (${budget} Budget)
* **Accommodation:** ₹1,500 - ₹3,500 per night (standard to deluxe spiritual guest houses).
* **Local Transport:** ₹2,000 - ₹4,000 (private AC cab for Rajgir-Nalanda circuit).
* **Meals:** ₹500 - ₹1,200 per day per person.
* **Entry Tickets & Guides:** ₹300 - ₹600 per person.
        `;
  } else if (dest.includes('patna') || dest.includes('patliputra')) {
    overview = `Welcome to the **Patna Capital Heritage Itinerary**. This ${days}-day trip is tailored for a **${budget}** budget to explore the historical sights, museums, and religious hubs along the River Ganges.`;

    dayByDay = `
### 📅 Day 1: Historic Patna City & Museums
* **Morning (09:00 AM - 12:30 PM):** Start your day at the world-class **Bihar Museum**, showcasing extraordinary ancient artifacts including the Didarganj Yakshi.
* **Afternoon (01:30 PM - 04:30 PM):** Walk over to the historical **Golghar**, built in 1786 as a granary, and climb the spiral stairs for a panoramic view of Patna and the Ganges.
* **Evening (05:30 PM - 08:30 PM):** Enjoy a relaxing walk at the Eco Park (Rajdhani Vatika) or take a sunset boat cruise along the Ganges from Gandhi Ghat.

### 📅 Day 2: Spiritual Patna & Heritage Markets
* **Morning (08:30 AM - 11:30 AM):** Visit **Takht Sri Patna Sahib**, the birthplace of Guru Gobind Singh Ji, one of the five holy takhts of Sikhism.
* **Afternoon (12:00 PM - 03:00 PM):** Walk through Patna Market or Maurya Lok to shop for traditional Madhubani paintings, stone carvings, and local fabrics.
* **Evening (04:00 PM - 07:00 PM):** Visit the Patna Planetarium or watch the musical fountain show at Buddha Smriti Park near Patna Junction.
        `;

    costs = `
### 💰 Estimated Cost Breakdown (${budget} Budget)
* **Accommodation:** ₹1,800 - ₹4,500 per night (city-center standard to business-class stays).
* **Local Transport:** ₹800 - ₹1,500 per day (auto-rickshaws, metro, or local cabs).
* **Meals:** ₹600 - ₹1,500 per day per person.
        `;
  } else {
    // General Bihar Heritage Itinerary
    overview = `Welcome to your **Bihar Heritage Explorations Itinerary**. This ${days}-day trip is customized for your interests in *${interestStr}* under a **${budget}** budget. You will explore Bihar's prominent cultural attractions.`;

    dayByDay = `
### 📅 Day 1: Architectural Treasures & Local Vibe
* **Morning (09:00 AM - 12:00 PM):** Arrive at ${destination}. Explore the prominent regional temple, heritage site, or central square.
* **Afternoon (01:30 PM - 04:00 PM):** Indulge in local delicacies like piping-hot Litti Chokha or Silao Khaja. Visit a local museum or artisan market.
* **Evening (05:00 PM - 07:30 PM):** Sunset walk along a local waterbody or park, interacting with local guides to hear historical folklores.

### 📅 Day 2: Historic Sites & Nature Excursions
* **Morning (08:00 AM - 11:30 AM):** Excursion to the nearest heritage fortress, ruins, or spiritual site. Capture photographs during early morning soft hours.
* **Afternoon (12:30 PM - 03:30 PM):** Enjoy a traditional lunch, followed by shopping for regional handloom items (e.g. Bhagalpuri Silk or Madhubani art).
* **Evening (04:30 PM onwards):** Onward travel connection or relaxing evening leisure.
        `;

    costs = `
### 💰 Estimated Cost Breakdown (${budget} Budget)
* **Accommodation:** ₹1,200 - ₹3,000 per night.
* **Local Transport:** ₹800 - ₹2,000 (local auto-rickshaw rentals or hired car).
* **Meals:** ₹400 - ₹1,000 per day.
        `;
  }

  food = `
### 🍲 Recommended Local Foods to Try
* **Litti Chokha:** Spiced gram flour stuffed wheat balls cooked on coal, served with smokey eggplant mash.
* **Silao Khaja:** GI-tagged crisp multi-layered sweet pastry from Silao town.
* **Sattu Sharbat:** Protein-packed refreshing savory summer drink.
* **Bhagalpuri Pedas:** Rich milk sweets famous across Eastern Bihar.
    `;

  tips = `
### 📌 Important Travel Tips for ${destination}
1. **Best Time to Visit:** October to March when the weather is cool and pleasant.
2. **Photography:** Always check if photography is permitted inside monastic ruins or main temples.
3. **Local Guides:** Hire only certified tourism department guides for rich, authentic stories at historic spots.
4. **Hydration:** Always carry bottled mineral water during your daytime walks.
    `;

  return `
# 🗺️ Saarthi Custom Travel Plan: ${destination}

${overview}

---

## 🗺️ Day-by-Day Itinerary

${dayByDay}

---

${costs}

---

${food}

---

${tips}
`.trim();
}

// POST /api/v1/ai/plan-trip
export const generateTripPlan = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  const { destination, days, budget, interests } = req.body;

  // HIGH-3: Sanitize prompt inputs to prevent injection
  const sanitizedDestination = destination ? String(destination).replace(/[^a-zA-Z0-9\s,.-]/g, '').slice(0, 100) : 'Bihar';
  const sanitizedInterests = Array.isArray(interests)
    ? interests.map(i => String(i).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50))
    : [];

  try {
    const apiKey = env.GEMINI_API_KEY;
    const isPlaceholder = !apiKey ||
      apiKey.includes("your_actual_gemini_key_here") ||
      apiKey.includes("placeholder") ||
      apiKey === "your_gemini_api_key" ||
      apiKey.trim() === "";

    if (isPlaceholder) {
      console.log(`Missing or placeholder GEMINI_API_KEY in backend. Generating high-fidelity local plan for ${sanitizedDestination}...`);
      const localPlan = getLocalTripPlan(sanitizedDestination, days, budget, sanitizedInterests);
      return res.status(200).json({ plan: localPlan });
    }

    const prompt = `
      Act as "Saarthi", an expert local travel planner for Bihar Tourism.
      Create a highly detailed, day-by-day travel itinerary for a ${days}-day trip to ${sanitizedDestination}.
      The budget level is: ${budget}.
      The user's specific interests are: ${sanitizedInterests.join(', ') || 'general sightseeing'}.
      
      Provide the response in a structured markdown format including:
      - A brief overview of the trip.
      - Day-by-day itinerary (morning, afternoon, evening).
      - Estimated costs breakdown.
      - Recommended local foods to try.
      - Important travel tips for ${sanitizedDestination}.
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ plan: text });
  } catch (error: any) {
    console.error('Gemini API Error, falling back to local itinerary plan:', error);
    try {
      const localPlan = getLocalTripPlan(sanitizedDestination, days, budget, sanitizedInterests);
      return res.status(200).json({ plan: localPlan });
    } catch (fallbackError) {
      console.error('Local fallback itinerary failed:', fallbackError);
      return res.status(500).json({ error: 'Failed to generate trip plan. Please try again later.' });
    }
  }
};

// POST /api/v1/ai
export const chatWithSaarthi = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const sanitizedPrompt = String(prompt).slice(0, 1000);

  try {
    const apiKey = env.GEMINI_API_KEY;
    const isPlaceholder = !apiKey ||
      apiKey.includes("your_actual_gemini_key_here") ||
      apiKey.includes("placeholder") ||
      apiKey === "your_gemini_api_key" ||
      apiKey.trim() === "";

    if (isPlaceholder) {
      return res.status(200).json({ response: `I am Saarthi, your local guide to Bihar. (Local fallback mode: You asked: "${sanitizedPrompt}"). Please configure Gemini API keys for full AI capabilities.` });
    }

    const sysPrompt = `
      You are "Saarthi", an expert local travel companion for Bihar Tourism. 
      Keep your answers brief, engaging, and specifically tailored to Bihar.
      User says: ${sanitizedPrompt}
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const result = await model.generateContent(sysPrompt);
    const text = result.response.text();

    return res.status(200).json({ response: text });
  } catch (error: any) {
    console.error('Gemini API Error in Chat:', error);
    return res.status(200).json({ response: "I'm having a little trouble connecting right now, but I'm excited to help you explore Bihar! Ask me another question." });
  }
};

// POST /api/v1/ai/save-itinerary
export const saveItinerary = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const { title, preferences, itinerary } = req.body;

    if (!title || !preferences || !itinerary) {
      return res.status(400).json({ error: 'Title, preferences, and itinerary are required' });
    }

    const { data, error } = await supabase
      .from('saved_itineraries')
      .insert([{
        user_id: userId,
        title,
        preferences,
        itinerary
      }])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Save Itinerary Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/ai/saved
export const getSavedItineraries = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;

    const { data, error } = await supabase
      .from('saved_itineraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/v1/ai/saved/:id
export const deleteSavedItinerary = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    const { error } = await supabase
      .from('saved_itineraries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

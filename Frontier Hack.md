# **Design Document**

## **Project Title**

**Doc-to-Minecraft Historical Learning Agent**

## **1\. Overview**

This system converts a teacher-uploaded historical chapter into a short, immersive Minecraft learning experience. A student enters a locally hosted Minecraft world and is guided by a visible companion bot through a single historically inspired scene, such as Pompeii during the eruption, where the bot narrates context, asks questions, and gives the student a small exploration objective tied to the lesson.

The product is aimed at **middle school learners** and optimizes for:

* quiz performance  
* engagement through exploration  
* contextual retention through dialogue and environment  
* lightweight adaptation based on the student’s behavior

The core idea is not to recreate history with full simulation accuracy. Instead, it creates a **pedagogically useful, creative augmentation** of a historical chapter in Minecraft, where the world becomes a guided educational stage.

---

## **2\. Goals**

### **Primary goals**

* Turn an uploaded chapter into a playable Minecraft scene automatically  
* Generate a **single coherent experience**  
* Use a visible bot companion as the “NPC guide”  
* Ask **3–5 questions** during the session  
* Adapt based on:  
  * incorrect answers  
* Run on a **local Minecraft server**  
* Use **Mineflayer normal bot actions only**, without relying on mobs or advanced server plugin stacks

### **Secondary goals**

* Make the experience feel story-like rather than quiz-like  
* Keep the teacher workflow lightweight  
* Preserve a clean separation between chapter understanding and world execution

---

## **3\. Non-goals**

* Large open-world generation  
* High-fidelity cinematic world editing  
* Summoning mobs or advanced NPC systems  
* Perfect historical reconstruction  
* Full procedural world generation across arbitrary terrain  
* Rich teacher authoring dashboards in the MVP

---

## **4\. User Personas**

### **Teacher**

Uploads a historical chapter and expects the system to produce a usable interactive experience with minimal manual setup.

### **Student**

A middle school learner who joins the Minecraft world, follows a guide bot, learns through short narration, explores the scene, and answers questions in chat.

---

## **5\. Product Experience**

## **5.1 Example session: Pompeii**

1. Teacher uploads a chapter on Pompeii and Mount Vesuvius.  
2. System extracts:  
   * Pompeii  
   * volcano eruption  
   * ash, destruction, evacuation  
   * Roman daily life  
   * key facts and timeline  
3. System creates one scene:  
   * small Roman-styled street  
   * signs of panic and ash damage  
   * raised terrain and lava/ash-like visual cues  
   * one hidden objective item, such as a “diamond” reframed as a protected artifact  
4. Student joins world.  
5. Guide bot greets and escorts the student.  
6. At specific locations, the bot narrates facts and asks questions.  
7. Student explores and finds the objective item.  
8. Bot checks answers and progress, gives hints if needed, then ends with a recap.

---

# **6\. High-Level Architecture**

Teacher Types in prompt  
  v  
\[Model 1: Chapter Understanding / Experience Planner\]  
  |---- generates retrieval queries  
  |---- extracts entities, events, settings, teaching goals  
  |---- outputs scene brief \+ teaching script \+ question plan  
  |  
  v  
\[Experience Package\]  
  |  
  v  
\[Model 2: Scene Understander / Scene Builder\]  
  |---- inspects current world state  
  |---- creates action plan from scene brief  
  |---- executes build/navigation plan through Mineflayer  
  |  
  v  
\[Runtime Tutor Bot\]  
  |---- guides student  
  |---- monitors location, timing, answers, interactions  
  |---- asks questions and gives hints  
  |  
  v  
\[Session State \+ Assessment Output\]  
---

# **7\. Core System Components**

## **7.1 Document Ingestion Layer**

### **Responsibilities**

* accept teacher-uploaded chapter  
* chunk and embed text for retrieval  
* store source material  
* support structured extraction for the planning model

### **Inputs**

* plain text chapter  
* optional teacher hints:  
  * grade level  
  * topic name  
  * preferred number of questions  
  * objective emphasis

### **Outputs**

* normalized text chunks  
* metadata  
* retrievable chapter context

### **Notes**

Because the system allows **creative augmentation**, retrieval is grounding, not a hard limitation. The model may enrich the scene beyond the uploaded text as long as the core facts remain consistent with the lesson.

---

## **7.2 Model 1: Chapter Understanding / Experience Planner**

This is the pedagogical brain.

### **Responsibilities**

* understand the chapter  
* identify the historical setting, sequence, and key concepts  
* choose one scene  
* translate historical content into Minecraft-compatible representations  
* generate dialogue and assessment beats  
* define a learner objective

### **Example output tasks**

* “What setting best captures the chapter in one scene?”  
* “What 3–5 questions test understanding during movement?”  
* “What object-finding objective reinforces the lesson?”  
* “What facts should be delivered at each location?”

### **Output artifact: `ExperiencePackage`**

This should be a structured JSON object, not just free text.

Example schema:

{  
 "experience\_id": "pompeii\_scene\_001",  
 "title": "Escape from Pompeii",  
 "grade\_band": "middle\_school",  
 "duration\_minutes": 6,  
 "learning\_objectives": \[  
   "Understand what happened during the eruption of Mount Vesuvius",  
   "Recognize how Pompeii preserved evidence of Roman life",  
   "Recall key facts through scene-based questioning"  
 \],  
 "historical\_summary": "...",  
 "creative\_license": {  
   "enabled": true,  
   "notes": "Use symbolic quest item and simplified city layout"  
 },  
 "scene\_spec": {  
   "theme": "Pompeii during eruption",  
   "size": "medium",  
   "regions": \[  
     {  
       "id": "entry\_street",  
       "purpose": "introduction",  
       "description": "Roman street with damaged buildings and ash-like blocks"  
     },  
     {  
       "id": "market\_area",  
       "purpose": "contextual narration",  
       "description": "Signs of daily Roman life disrupted by eruption"  
     },  
     {  
       "id": "volcano\_view",  
       "purpose": "climax",  
       "description": "Raised terrain with lava and smoke-like effect blocks"  
     }  
   \]  
 },  
 "student\_objective": {  
   "type": "find\_item",  
   "item\_name": "diamond",  
   "narrative\_label": "preserved artifact",  
   "placement\_rule": "hidden near final region but reachable"  
 },  
 "dialogue\_plan": \[...\],  
 "question\_plan": \[...\],  
 "trigger\_plan": \[...\],  
 "success\_conditions": \[...\],  
 "fallback\_hints": \[...\]  
}  
---

## **7.3 Model 2: Scene Understander / Scene Builder**

This is the world translation and execution brain.

### **Responsibilities**

* inspect the current Minecraft scene  
* determine whether the selected area is suitable  
* convert the scene brief into build steps  
* place and remove blocks using normal bot actions  
* ensure the environment is navigable for both bot and student  
* initialize the runtime tutoring state

### **Important constraint**

This system uses **normal bot actions only**, not high-level server editing commands. That makes build planning much more constrained. Mineflayer can navigate, inspect world state, dig, place blocks, manage inventory, and interact through chat and entities, but it is still a bot API rather than a dedicated world-edit system. 

### **Implication**

The builder should:

* keep scenes compact  
* prefer symbolic and modular builds  
* reuse nearby terrain where possible  
* avoid massive structures  
* verify walkability continuously

---

## **7.4 Runtime Tutor Bot**

This is the visible companion “NPC.”

### **Responsibilities**

* greet the player  
* walk with the player  
* deliver facts in context  
* ask questions at checkpoints  
* evaluate answers  
* redirect and hint  
* conclude the lesson

### **Why a stateful design is needed**

The guide behavior is inherently staged:

* intro  
* escort  
* explain  
* question  
* wait  
* evaluate  
* hint  
* continue  
* conclude

A finite-state approach is a good fit, and the Mineflayer state-machine plugin is specifically intended to keep more complex bot behavior manageable. 

---

# **8\. Detailed Runtime Flow**

## **8.1 Pre-session generation**

1. Teacher uploads chapter  
2. Document is parsed and indexed  
3. Model 1 generates `ExperiencePackage`  
4. Model 2 selects a build area in the world  
5. Bot gathers required materials or loads a pre-stocked inventory  
6. Bot builds the scene  
7. Bot validates pathability and trigger positions  
8. Session becomes playable

## **8.2 In-session experience**

1. Student spawns near entry point  
2. Guide bot introduces itself  
3. Bot leads player to region 1  
4. Bot delivers fact 1  
5. Bot asks question 1  
6. Bot evaluates answer  
7. Bot continues to region 2  
8. Player explores and receives objective hints  
9. Bot tracks time and learner movement  
10. Bot asks additional questions  
11. Player finds the objective item  
12. Bot summarizes lesson and performance

---

# **9\. Pedagogical Design**

## **9.1 Middle-school principles**

The experience should:

* use short, concrete language  
* emphasize cause-and-effect  
* include visual anchors  
* avoid long expository speeches  
* ask manageable questions  
* reward movement and discovery

## **9.2 Question types**

Recommended mix:

* 2 factual recall questions  
* 1 cause/effect question  
* 1 location/objective-linked question  
* optional final recap question

Example:

* “What caused Pompeii to be buried?”  
* “Why do archaeologists learn so much from Pompeii?”  
* “What does this marketplace tell us about Roman daily life?”

## **9.3 Adaptation rules**

The bot adapts to:

* **location**: if student reaches a trigger zone, narrate relevant fact  
* **time spent**: if delayed too long, offer a hint  
* **incorrect answers**: simplify or scaffold the question  
* **interactions**: if student finds the item early, branch forward

---

# **10\. World and Scene Design**

## **10.1 Scene size**

Because the system is limited to normal bot actions, the scene should be **medium-sized and dense**, not large. The design should target a compact playable region with a clear route and a few meaningful sub-areas. THE LIMIT OF THE PLAY area is 100 x 100 x 100\. The world should be super flat, and should be built at 0,0,0. The player should be teleported to 0,0,0  

### **Recommended target**

* compact guided footprint  
* visually distinct landmarks  
* low ambiguity in navigation  
* low build complexity per session

## **10.2 Scene composition strategy**

Each generated scene should have:

* entry zone  
* 2–3 teaching zones  
* final objective zone  
* one safe return/end zone

## **10.3 Build grammar**

Model 1 should not output arbitrary prose like “build an ancient city.” It should output a constrained build grammar such as:

* damaged stone house  
* narrow path  
* ash-like block palette  
* raised lava-view ridge  
* hidden chest niche  
* broken market stall

This makes Model 2’s action planning much more reliable.

---

# **11\. Agent and Data Contracts**

## **11.1 Model 1 output contract**

Model 1 must produce:

* one selected scene  
* learning objectives  
* scene regions  
* dialogue beats  
* question plan  
* trigger conditions  
* objective design  
* aesthetic constraints  
* factual grounding notes

## **11.2 Model 2 input contract**

Model 2 consumes:

* scene brief  
* available materials  
* current world scan  
* player start location  
* bot inventory/state

## **11.3 Model 2 output contract**

Model 2 produces:

* build plan  
* navigation graph  
* trigger placement plan  
* runtime state initialization  
* execution report

---

# **12\. Tooling and API Layer**

## **12.1 Mineflayer responsibilities**

Mineflayer is the runtime foundation for:

* connecting a bot to the local server  
* observing entities and players  
* reading chat  
* moving and looking  
* digging and placing blocks  
* handling inventory and equipment  
* interacting with world state. 

## **12.2 Pathfinder plugin**

The pathfinder plugin is critical for:

* escorting the student  
* reaching build sites  
* navigating uneven terrain  
* setting static or dynamic goals. The plugin supports autonomous navigation via goal-based pathfinding. 

## **12.3 Optional helper plugins**

A helper like `mineflayer-collectblock` may be useful if you let the bot collect materials autonomously, since it wraps pathfinding, tool selection, mining, and collection into a simpler workflow. 

---

# **13\. System Modules**

## **13.1 Upload Service**

* handles teacher document upload  
* stores raw file  
* triggers ingestion pipeline

## **13.2 Retrieval Service**

* chunking  
* embeddings  
* semantic retrieval for Model 1  
* optional source grounding references

## **13.3 Experience Planner Service**

* calls Model 1  
* validates structured output  
* stores `ExperiencePackage`

## **13.4 Scene Builder Service**

* calls Model 2  
* scans world state  
* chooses build footprint  
* executes block actions

## **13.5 Bot Runtime Service**

* launches Mineflayer bot  
* loads plugins  
* executes tutor FSM  
* maintains session variables

## **13.6 Assessment Service**

* stores answers  
* tracks correctness  
* emits final session summary

---

# **14\. Suggested Internal Architecture**

## **14.1 Why your original 2-model split is good**

Your two-part split is useful:

### **Model 1**

**Information Gathering \+ Experience Planning**

* chapter understanding  
* retrieval queries  
* context synthesis  
* scene narrative

### **Model 2**

**Scene Understanding \+ Build Execution**

* world inspection  
* action plan generation  
* runtime control

That said, inside implementation I would logically split runtime behavior into submodules even if you keep only two model identities.

## **14.2 Practical internal submodules**

Even with 2 models, implement these four logical services:

* planner  
* builder  
* tutor  
* assessor

The tutor and assessor do not need to be separate foundation models; they can be runtime policies driven by a smaller model or rule layer.

---

# **15\. State Management**

## **15.1 Persistent state**

Store:

* uploaded document  
* chunk embeddings  
* generated experience package  
* world build report  
* dialogue templates  
* question templates

## **15.2 Session state**

Store:

* player position  
* current region  
* completed checkpoints  
* wrong answer count  
* hint count  
* objective found or not  
* elapsed time  
* chat transcript  
* final score

Example session object:

{  
 "session\_id": "sess\_001",  
 "experience\_id": "pompeii\_scene\_001",  
 "player\_name": "student1",  
 "current\_state": "QUESTION\_2",  
 "visited\_regions": \["entry\_street", "market\_area"\],  
 "question\_results": \[  
   { "qid": "q1", "correct": true, "attempts": 1 },  
   { "qid": "q2", "correct": false, "attempts": 2 }  
 \],  
 "objective\_found": false,  
 "time\_elapsed\_sec": 188  
}  
---

# **16\. Runtime Behavior Model**

## **16.1 Proposed finite state machine**

IDLE  
 \-\> BUILD\_SCENE  
 \-\> WAIT\_FOR\_PLAYER  
 \-\> INTRODUCE  
 \-\> ESCORT\_TO\_REGION  
 \-\> NARRATE  
 \-\> ASK\_QUESTION  
 \-\> EVALUATE\_ANSWER  
     \-\> HINT  
     \-\> REASK  
     \-\> ADVANCE  
 \-\> MONITOR\_OBJECTIVE  
 \-\> CLIMAX\_RECAP  
 \-\> END\_SESSION

## **16.2 Trigger types**

* entering a coordinate radius  
* staying too long in area  
* incorrect answer count threshold  
* item found  
* reaching final region  
* no movement for N seconds

---

# **17\. Answer Evaluation Strategy**

## **17.1 Inputs**

* current question  
* accepted concepts  
* allowed paraphrases  
* student chat response  
* current context region

## **17.2 Evaluation modes**

### **MVP**

* keyword/concept matching  
* simple paraphrase rules  
* confidence threshold

### **Better version**

* small evaluator model that decides:  
  * correct  
  * partially correct  
  * incorrect  
  * off-topic

## **17.3 Middle-school-friendly feedback**

Avoid “wrong.” Prefer:

* “Close — think about what came out of the volcano.”  
* “You’re on the right track. What buried the city?”  
* “Look around this area. What does it tell us about Roman daily life?”

---

# **18\. Build Planning Strategy**

## **18.1 Core problem**

Turning a chapter into a Minecraft scene can fail if the model is too unconstrained.

## **18.2 Solution**

Use a **hierarchical build planner**.

### **Level 1: semantic scene plan**

* Roman street  
* market zone  
* volcano ridge  
* artifact hiding spot

### **Level 2: block template plan**

* path \= stone bricks / gravel  
* ash area \= gray concrete powder / basalt / tuff  
* damaged wall \= cobblestone \+ missing sections  
* lava ridge \= blackstone \+ lava pockets

### **Level 3: executable actions**

* move to x,y,z  
* place block  
* dig block  
* turn/look  
* step back  
* verify placement  
* continue

## **18.3 Constraint rules**

* all regions must be walkable  
* no trap layouts  
* no lava immediately on main path  
* objective must be reachable  
* bot path must remain valid after building

---

# **19\. Failure Modes and Mitigations**

## **19.1 Scene too large to build**

**Risk:** pure Mineflayer build is too slow  
**Mitigation:** cap region count and block budget

## **19.2 Bot gets stuck while escorting**

**Risk:** terrain/pathfinding failure  
**Mitigation:** pre-validate route graph; fallback teleport is unavailable in your current constraint set, so design safe terrain and recovery routes from the outset. Pathfinder’s goal-based navigation helps here, but route simplicity matters. 

## **19.3 Student goes off-route**

**Risk:** lesson pacing breaks  
**Mitigation:** guide bot follows and redirects with dialogue

## **19.4 Answer evaluation is brittle**

**Risk:** free text judged incorrectly  
**Mitigation:** use concept-based grading rather than exact phrase match

## **19.5 Generated scene is historically incoherent**

**Risk:** creative augmentation drifts too far  
**Mitigation:** require Model 1 to separate:

* grounded facts  
* creative dramatization  
* symbolic gameplay elements

## **19.6 Build materials unavailable**

**Risk:** bot cannot construct scene  
**Mitigation:** pre-stock bot inventory for MVP

---

# **20\. Security and Safety**

## **20.1 Educational safety**

* avoid frightening or graphic reenactments  
* keep historical disaster scenes symbolic, not traumatic  
* use age-appropriate dialogue

## **20.2 System safety**

* constrain prompt outputs to schemas  
* validate action plans before execution  
* reject dangerous or self-destructive block sequences  
* cap maximum build actions per session

---

# **21\. MVP Scope**

## **Included**

* one uploaded historical chapter  
* one generated scene  
* one visible guide bot  
* one student  
* 3–5 questions  
* 5–7 minute experience  
* local server  
* pure Mineflayer normal actions  
* creative but compact scene generation

## **Excluded**

* teacher preview editor  
* multi-scene campaigns  
* classroom analytics dashboard  
* command-assisted world editing  
* multi-bot casts  
* voice interaction

---

# **22\. Recommended Tech Stack**

## **Backend**

* Python or Node orchestration service  
* vector store for chapter retrieval  
* local or hosted LLM for Model 1 and Model 2

## **Minecraft runtime**

* local Java Edition server  
* Mineflayer bot  
* mineflayer-pathfinder  
* optional mineflayer-statemachine  
* optional collectblock helper depending on material acquisition needs. 

## **Storage**

* document store  
* vector index  
* session database  
* generated experience package store

---

# **23\. Evaluation Plan**

## **23.1 Technical evaluation**

Measure:

* scene generation success rate  
* build completion time  
* bot path success rate  
* trigger reliability  
* answer evaluation accuracy  
* session completion rate

## **23.2 Learning evaluation**

Measure:

* percentage of correct answers  
* improvement from first attempt to hint-assisted attempt  
* objective completion  
* time to completion  
* post-session recall quiz

## **23.3 Experience evaluation**

Measure:

* student engagement rating  
* teacher acceptance of generated scene  
* narrative coherence rating  
* perceived helpfulness of guide bot


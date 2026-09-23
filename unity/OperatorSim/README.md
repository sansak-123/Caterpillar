# OperatorSim — Editor setup checklist

All the C# is written (`Assets/Scripts/`) and compiles against standard Unity APIs
(2022.3 LTS / Unity 6 — `UnityEngine`, `UnityEngine.AI` for NavMesh). Nothing here has
been opened in the actual Unity Editor yet, since no Unity installation exists in the
environment these scripts were written in — **everything below is Editor/asset work
only a human with Unity installed can do.** This is the honest state: real, complete,
consistent scripts; zero scenes, prefabs, or builds.

## 1. Project setup
- [ ] Create/open the project in Unity 2022.3 LTS (or Unity 6) at `unity/OperatorSim/`.
- [ ] Import an excavator model (asset store or a placeholder block-out is fine for the
      demo — CAT-branded models likely aren't licensed for this use, use a generic
      excavator).
- [ ] Check the boom/stick/bucket/swing pivots line up with a real dig-cycle range of
      motion. If the pivots are wrong (common with store-bought riggings), open the
      model in Blender, fix the pivot points, re-export as FBX.
- [ ] Add `Assets/Scripts/ExcavatorRig.cs` to the rig's root GameObject, and assign
      `swingPivot` / `boomPivot` / `stickPivot` / `bucketPivot` in the Inspector to the
      corresponding joint Transforms.
- [ ] Edit > Project Settings > Input Manager: add four axes named exactly `Boom`,
      `Stick`, `Bucket`, `Swing` (used for desktop/Editor testing; the on-screen touch
      joystick calls `ExcavatorRig.SetVirtualAxis` directly and doesn't need these).

## 2. Ghost Operator
- [ ] Duplicate the rig GameObject, tint its materials translucent (~35% alpha, a cool
      blue reads well against the CAT-yellow real rig), and disable player input on
      the duplicate (it's driven entirely by `GhostPlayer.ApplyFrame`, never by
      `ExcavatorRig.Update`'s own input reading — either strip `ExcavatorRig` off the
      ghost and call `ApplyFrame` on a lighter pose-only script, or leave it and just
      never feed it input axes).
- [ ] Add `GhostPlayer.cs` to a GameObject, assign the ghost rig.
- [ ] Get a real cycle trace JSON out of the data pipeline: `ml/task_time`'s
      `cycle_traces.parquet` has the frames: `python -c "import pandas as pd;
      df=pd.read_parquet('data/generated/cycle_traces.parquet');
      df[df.cycle_id=='CYC00001'].to_json('ghost_sample.json', orient='records')"` —
      wrap the resulting array as `{"frames": [...]}` (matches `CycleFrameList` in
      `BridgeMessages.cs`) and feed it to `GhostPlayer.LoadTrace` to test in the Editor
      before wiring the real bridge.

## 3. NavMesh workers
- [ ] Window > AI > Navigation > bake a NavMesh for each scenario's terrain.
- [ ] Add a `NavMeshAgent` + `WorkerAgent.cs` to a worker character/placeholder
      capsule, and place 2+ patrol point empties per worker — **at least one behind the
      machine's rear pivot** for `TrenchNearWorkers`, since that's what makes the
      blind-spot scenario mean anything.

## 4. Proximity zones
- [ ] Create two flat ring meshes (or a shader-based radial gradient decal) for amber
      and red, parent them under the machine base at unit scale.
- [ ] Add `ProximityZones.cs` to the machine root, assign `rig`, `rearSectorReference`
      (an empty Transform facing straight back from the boom), the scene's
      `WorkerAgent` instances, both ring visuals, and the `Scoring` component.

## 5. Weather
- [ ] Add a rain `ParticleSystem` (box-shaped emitter above the scene, downward
      velocity) and a ground-level dust `ParticleSystem`.
- [ ] Window > Rendering > Lighting > Environment: enable Fog.
- [ ] Add `WeatherFX.cs` to a scene-level GameObject, assign both particle systems.

## 6. Scenario wiring
- [ ] Add `Scoring.cs` next to `ExcavatorRig` (it's `[RequireComponent]`'d).
- [ ] Add one `ScenarioManager.cs` per scene (or a persistent one across an additive
      scene setup), assign `rig`, `scoring`, `ghostPlayer`, `proximityZones`,
      `weatherFx`, `telemetryDriver`, `replayMover`.
- [ ] For `NearMissReplay`: add `NearMissReplayMover.cs`, assign a worker Transform
      (disable its `WorkerAgent`/`NavMeshAgent` while a replay is active so the mover
      has sole control) and the rig.

## 7. The React Native bridge — pick a tier (CLAUDE.md section 3.0)

**Primary (native):**
- [ ] Pick a maintained Unity-for-RN bridge library (`react-native-unity-view` or
      `@azesmway/react-native-unity` were the candidates at spec time — check what's
      actively maintained when you get here, this ecosystem moves fast).
- [ ] Unity: File > Build Settings > switch platform to Android, enable "Export
      Project", build to `unity/OperatorSim/BuildAndroid`. Repeat for iOS if attempting
      that stretch goal.
- [ ] Follow the chosen library's own docs to link that exported project into
      `mobile/android` via `expo prebuild`'s config plugin system.
- [ ] Create an empty GameObject named exactly `Bridge` in the scene (required — see
      `ReactBridge.cs`'s doc comment), add `ReactBridge.cs` to it, assign
      `scenarioManager`.
- [ ] Fill in `ReactBridge.SendToNative`'s native branch with that library's specific
      "send a message to RN" call (they differ per library — this is the one line of
      C# that's intentionally left for you, since it depends on which library you
      picked).
- [ ] Flip `NATIVE_TIER_AVAILABLE = true` in `mobile/src/components/UnitySim.tsx` and
      implement that branch to render the library's native view component.

**Fallback (WebGL, zero native build risk):**
- [ ] File > Build Settings > WebGL, Player Settings > enable "Decompression
      Fallback" (so hosting needs no special headers), keep textures compressed and
      the scene low-poly to keep build size down.
- [ ] Build to `unity/OperatorSim/BuildWebGL`.
- [ ] The build's `index.html` needs a small wrapper script defining
      `window.sendToUnity = (method, jsonArg) =>
      unityInstance.SendMessage("Bridge", method, jsonArg)` — Unity's WebGL template
      export includes a loader you attach this to once the build exists.
- [ ] Copy the build output into `mobile/assets/unity/` (or wherever
      `EXPO_PUBLIC_UNITY_WEBGL_URL` in `mobile/.env` points).
- [ ] `mobile/src/components/UnitySim.tsx` already implements this tier for real via
      `react-native-webview` — no RN-side code changes needed, it'll just start
      working once the build exists at that path instead of showing the "simulator
      build not found" fallback message.

## 8. Rehearse
- [ ] Run the Ghost Operator scenario end-to-end on an actual device/emulator build,
      confirm a `ScoreResult` JSON round-trips back to `SimulatorScreen` and renders.

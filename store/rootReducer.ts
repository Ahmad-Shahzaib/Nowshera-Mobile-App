import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { combineReducers, Reducer } from "redux";
import { PersistConfig, persistReducer } from "redux-persist";
import createWebStorage from "redux-persist/lib/storage/createWebStorage";
import authReducer from "./slices/auth";
import coursesReducer from "./slices/courses";
import { clearStore } from "./utils";


const createNoopStorage = () => ({
  getItem(): Promise<null> {
    return Promise.resolve(null);
  },
  setItem(_key: string, value: any): Promise<any> {
    return Promise.resolve(value);
  },
  removeItem(): Promise<void> {
    return Promise.resolve();
  },
});


// Use web storage only when running on web, otherwise use React Native's
// AsyncStorage (Expo / React Native). Using Platform.OS === 'web' avoids
// environments where `window` exists but `localStorage` isn't available and
// prevents redux-persist from trying to create web storage on native.
const storage = Platform.OS === "web" ? createWebStorage("local") : AsyncStorage;

const rootPersistConfig: PersistConfig<any> = {
  key: "root",
  storage,
  keyPrefix: "redux-",
  whitelist: [],
};


const coursesPersistConfig: PersistConfig<any> = {
  key: "courses",
  storage,
  keyPrefix: "redux-",
  whitelist: [],
};

const authPersistConfig: PersistConfig<any> = {
  key: "auth",
  storage,
  keyPrefix: "redux-",
  whitelist: [],
};





const appReducer = combineReducers({
  courses: persistReducer(coursesPersistConfig, coursesReducer),
  auth: persistReducer(authPersistConfig, authReducer),
});

const rootReducer: Reducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: any | never,
) => {
  if (action.type === clearStore.type) {
    storage.removeItem("redux-root");
    if (Platform.OS === "web") {
      // Clear browser storage only on web
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    }
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export type RootState = ReturnType<typeof rootReducer>;
export { rootPersistConfig, rootReducer };


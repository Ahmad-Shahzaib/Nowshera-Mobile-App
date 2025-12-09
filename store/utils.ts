// import { userActions } from "@/redux/slices/user";
import { createAction } from "@reduxjs/toolkit";

export const clearStore = createAction("util/clearStore");

export const resetAllSlices = () => (dispatch: any) => {
  dispatch(clearStore());
  // dispatch(userActions.resetUserState());

};

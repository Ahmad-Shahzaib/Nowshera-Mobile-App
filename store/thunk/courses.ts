import { getAxiosInstance } from "@/lib/axios";
import { createAsyncThunk } from "@reduxjs/toolkit";

const coursesApis = getAxiosInstance();

interface FetchCourseParams {
  // optional filters or pagination can go here
}

export const fetchCoursesData = createAsyncThunk(
  "courses/fetchAll",
  async (params: FetchCourseParams, { rejectWithValue }) => {
    try {
      const response = await coursesApis.get("/courses");
      return response.data; // returns array of courses
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Failed to fetch course data";
      return rejectWithValue(errorMessage);
    }
  }
);

interface RemoveCourseParams {
  id: string;
}

export const removeCourse = createAsyncThunk(
  "courses/remove",
  async (params: RemoveCourseParams, { rejectWithValue }) => {
    try {
      const response = await coursesApis.delete(`/courses/${params.id}`);
      return params.id;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || "Failed to remove course";
      return rejectWithValue(errorMessage);
    }
  }
);

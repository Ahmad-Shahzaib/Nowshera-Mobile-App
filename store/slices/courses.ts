import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { fetchCoursesData, removeCourse } from "../thunk/courses";

interface Course {
    _id: string;
    title: string;
    description: string;
    image: string;
    link: string;
    createdAt: string;
    updatedAt: string;
}

interface CoursesState {
    isLoading: boolean;
    error: string | null;
    data: Course[];
}

const defaultState: CoursesState = {
    isLoading: false,
    error: null,
    data: [],
};

const coursesSlice = createSlice({
    name: "courses",
    initialState: defaultState,
    reducers: {
        resetCoursesState: () => defaultState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCoursesData.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchCoursesData.fulfilled, (state, action: PayloadAction<Course[]>) => {
                state.isLoading = false;
                state.data = action.payload;
            })
            .addCase(fetchCoursesData.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || "Failed to fetch courses";
            })
            .addCase(removeCourse.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(removeCourse.fulfilled, (state, action: PayloadAction<string>) => {
                state.isLoading = false;
                // remove the deleted course from state.data
                state.data = state.data.filter((c) => c._id !== action.payload);
            })
            .addCase(removeCourse.rejected, (state, action) => {
                state.isLoading = false;
                state.error = (action.payload as string) || action.error.message || "Failed to remove course";
            });
    },
});


export const { resetCoursesState } = coursesSlice.actions;

export default coursesSlice.reducer;
export const actions = coursesSlice.actions;
export { actions as coursesActions };


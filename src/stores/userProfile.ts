import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

export interface UserProfile {
	user_id: number;
	age: number | null;
	height_cm: number | null;
	weight_kg: number | null;
	training_experience_months: number | null;
	pharma_flag: boolean | null;
	pharma_notes: string | null;
	one_rm_squat: number | null;
	one_rm_bench: number | null;
	one_rm_deadlift: number | null;
}

export const useUserProfileStore = defineStore('userProfile', {
	state: () => ({
		profile: null as UserProfile | null,
		loading: false as boolean,
	}),
	actions: {
		async load(userId: number) {
			this.loading = true;
			try {
				const rows = await query<UserProfile>(
					`SELECT user_id, age, height_cm, weight_kg, training_experience_months, pharma_flag, pharma_notes, one_rm_squat, one_rm_bench, one_rm_deadlift FROM user_profiles WHERE user_id = ?`,
					[userId]
				);
				this.profile = rows[0] ?? {
					user_id: userId,
					age: null,
					height_cm: null,
					weight_kg: null,
					training_experience_months: null,
					pharma_flag: null,
					pharma_notes: null,
					one_rm_squat: null,
					one_rm_bench: null,
					one_rm_deadlift: null,
				};
			} finally {
				this.loading = false;
			}
		},
		async save(profile: Partial<UserProfile> & { user_id: number }) {
			const ts = Date.now();
			await exec(
				`UPDATE user_profiles SET 
          age = COALESCE(?, age),
          height_cm = COALESCE(?, height_cm),
          weight_kg = COALESCE(?, weight_kg),
          training_experience_months = COALESCE(?, training_experience_months),
          pharma_flag = COALESCE(?, pharma_flag),
          pharma_notes = COALESCE(?, pharma_notes),
          one_rm_squat = COALESCE(?, one_rm_squat),
          one_rm_bench = COALESCE(?, one_rm_bench),
          one_rm_deadlift = COALESCE(?, one_rm_deadlift),
          updated_at = ?
        WHERE user_id = ?`,
				[
					profile.age ?? null,
					profile.height_cm ?? null,
					profile.weight_kg ?? null,
					profile.training_experience_months ?? null,
					profile.pharma_flag == null ? null : profile.pharma_flag ? 1 : 0,
					profile.pharma_notes ?? null,
					profile.one_rm_squat ?? null,
					profile.one_rm_bench ?? null,
					profile.one_rm_deadlift ?? null,
					ts,
					profile.user_id,
				]
			);
			await this.load(profile.user_id);
		},
	},
});

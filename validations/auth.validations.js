import { z } from "zod";

// export const registerSchema = z.object({
//   name: z.string().min(3),
//   email: z.email(),
//   password: z.string().min(8),
// });

export const registerSchema = z.object({
  name: z.string().min(3, "Name kam se kam 3 characters ka hona chahiye"),

  email: z.email("Please enter a valid email"),

  password: z
    .string()
    .min(8, "Password kam se kam 8 characters ka hona chahiye"),
});
import { CHEF_LUNA_TOOLS } from "@/lib/verticals/chef/tools";

export const privateChefPack = {
  key: "private_chef_services",
  name: "Private Chef Services",
  tools: CHEF_LUNA_TOOLS,
} as const;

export default {
  async beforeCreate(event) {
    const { params, state } = event;
    const user = state?.auth?.credentials?.user || state?.user;
    if (user && params?.data) {
      params.data.owner = user.id;
    }
  }
};

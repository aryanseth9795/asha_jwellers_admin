import React from "react";
import ToastHost from "./ToastHost";
import ConfirmHost from "./ConfirmHost";

/** Mount once at the app root, outside the navigator, so banners survive navigation (notifications spec §3). */
const NotifyRoot: React.FC = () => (
  <>
    <ToastHost />
    <ConfirmHost />
  </>
);

export default NotifyRoot;
